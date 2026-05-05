package main

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	samsara "github.com/DiegoSandival/samsara-go/handler"
	samsaraProtocol "github.com/DiegoSandival/samsara-go/protocol"
	quicnet "github.com/DiegoSandival/synap2p-go"
	"github.com/gorilla/websocket"
)

type App struct {
	cfg           resolvedConfig
	node          *quicnet.Node
	synap         *synapBridge
	samsaraParser *samsaraProtocol.ProtocolParser
	samsara       *samsara.CentralHandler
	indexHTML     []byte
	httpServer    *http.Server
}

func NewApp(cfg resolvedConfig) (*App, error) {
	indexHTML, err := os.ReadFile(cfg.indexPath)
	if err != nil {
		return nil, fmt.Errorf("read index file: %w", err)
	}

	node, err := quicnet.NewNode(cfg.synap2p)
	if err != nil {
		return nil, fmt.Errorf("build synap2p node: %w", err)
	}

	app := &App{
		cfg:           cfg,
		node:          node,
		synap:         newSynapBridge(node, cfg.requestTimeout),
		samsaraParser: &samsaraProtocol.ProtocolParser{},
		samsara:       samsara.NewCentralHandlerWithDBPath(cfg.samsaraDBPath),
		indexHTML:     indexHTML,
	}

	app.httpServer = &http.Server{
		Addr:              cfg.listenAddr,
		Handler:           app.routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	return app, nil
}

func (a *App) Run(ctx context.Context) error {
	a.logStartup()

	if err := a.node.Start(ctx); err != nil {
		return err
	}
	a.synap.Start(ctx)

	errCh := make(chan error, 1)
	go func() {
		a.logf("http listen start addr=%s mode=%s", a.cfg.listenAddr, a.cfg.mode)
		err := a.httpServer.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			a.logf("http listen error addr=%s err=%v", a.cfg.listenAddr, err)
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		_ = a.node.Close()
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	a.logf("shutdown start")
	_ = a.httpServer.Shutdown(shutdownCtx)
	err := a.node.Close()
	if err != nil {
		a.logf("shutdown node close error err=%v", err)
		return err
	}
	a.logf("shutdown complete")
	return nil
}

func (a *App) routes() http.Handler {
	var handler http.Handler
	if a.cfg.mode == ModeServer {
		handler = http.HandlerFunc(a.handleServer)
	} else {
		mux := http.NewServeMux()
		mux.HandleFunc(a.cfg.wsPath, a.handleClientWebSocket)
		mux.HandleFunc("/", a.handleClientHTTP)
		handler = mux
	}

	if a.cfg.logEnabled {
		return a.loggingMiddleware(handler)
	}
	return handler
}

func (a *App) handleServer(w http.ResponseWriter, r *http.Request) {
	host := normalizeHostName(stripPort(r.Host))
	a.logf("server route host=%s method=%s path=%s", host, r.Method, r.URL.Path)
	switch {
	case host == a.cfg.publicHost:
		a.handlePublicRead(w, r)
	case host == a.cfg.apiHost:
		a.handleServerAPI(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (a *App) handlePublicRead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	dbName, key, ok := splitPublicPath(r.URL.Path)
	if !ok {
		a.logf("public read invalid path=%s", r.URL.Path)
		http.Error(w, "expected /{db}/{key}", http.StatusBadRequest)
		return
	}
	a.logf("public read db=%s key=%s", dbName, key)

	request := a.samsaraParser.ReadFreeReqBytes([]byte(dbName), []byte(key))
	response := samsara.ProcessRequest(request, a.samsaraParser, a.samsara)
	if len(response) < 20 {
		a.logf("public read invalid response bytes=%d", len(response))
		http.Error(w, "invalid read_free response", http.StatusBadGateway)
		return
	}

	code := binary.BigEndian.Uint32(response[16:20])
	if code != 1 {
		status := http.StatusInternalServerError
		switch samsaraProtocol.ErrorCode(code) {
		case samsaraProtocol.ErrorCodeDatabaseNotFound, samsaraProtocol.ErrorCodeMembraneNotFound:
			status = http.StatusNotFound
		}
		a.logf("public read error db=%s key=%s error_code=%d status=%d", dbName, key, code, status)
		http.Error(w, string(response[20:]), status)
		return
	}
	a.logf("public read ok db=%s key=%s bytes=%d", dbName, key, len(response[20:]))

	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = w.Write(response[20:])
}

func (a *App) handleServerAPI(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			http.NotFound(w, r)
			return
		}
		a.serveIndex(w)
	case http.MethodPost:
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		a.handleBinaryHTTP(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{http.MethodGet, http.MethodPost}, ", "))
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *App) handleClientHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	a.serveIndex(w)
}

func (a *App) handleBinaryHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		a.logf("binary http read body error err=%v", err)
		http.Error(w, "read body", http.StatusBadRequest)
		return
	}
	a.logf("binary http request bytes=%d", len(body))

	response := a.dispatchHTTP(body)
	a.logf("binary http response bytes=%d", len(response))
	w.Header().Set("Content-Type", "application/octet-stream")
	_, _ = w.Write(response)
}

func (a *App) dispatchHTTP(frame []byte) []byte {
	target, opcode, requestID, errFrame := classifyFrame(frame)
	if errFrame != nil {
		a.logf("dispatch http classify error request_id=%x", requestID)
		return errFrame
	}
	a.logf("dispatch http opcode=0x%02x target=%s request_id=%x", opcode, target.String(), requestID)

	switch target {
	case dispatchTargetSamsara:
		return samsara.ProcessRequest(frame, a.samsaraParser, a.samsara)
	case dispatchTargetSynap:
		return a.synap.Request(frame)
	default:
		return errorResult(requestIDFromFrame(frame), ErrorCodeUnknownOpcode, "dispatcher.unknown_opcode")
	}
}

func (a *App) dispatchWebSocket(session *wsSession, frame []byte) []byte {
	target, opcode, requestID, errFrame := classifyFrame(frame)
	if errFrame != nil {
		a.logf("dispatch ws classify error request_id=%x", requestID)
		return errFrame
	}
	a.logf("dispatch ws opcode=0x%02x target=%s request_id=%x", opcode, target.String(), requestID)

	switch target {
	case dispatchTargetSamsara:
		return samsara.ProcessRequest(frame, a.samsaraParser, a.samsara)
	case dispatchTargetSynap:
		return a.synap.DispatchToSession(session, frame)
	default:
		return errorResult(requestIDFromFrame(frame), ErrorCodeUnknownOpcode, "dispatcher.unknown_opcode")
	}
}

func (a *App) serveIndex(w http.ResponseWriter) {
	transport := "http"
	if a.cfg.mode == ModeClient {
		transport = "ws"
	}

	replacer := strings.NewReplacer(
		"__DIARSABA_MODE_JSON__", strconv.Quote(a.cfg.mode),
		"__DIARSABA_TRANSPORT_JSON__", strconv.Quote(transport),
		"__DIARSABA_WS_PATH_JSON__", strconv.Quote(a.cfg.wsPath),
		"__DIARSABA_POST_PATH_JSON__", strconv.Quote("/"),
		"__DIARSABA_PEER_ID_JSON__", strconv.Quote(a.node.ID().String()),
	)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(replacer.Replace(string(a.indexHTML))))
}

var websocketUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (a *App) handleClientWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := websocketUpgrader.Upgrade(w, r, nil)
	if err != nil {
		a.logf("ws upgrade error remote=%s err=%v", r.RemoteAddr, err)
		return
	}
	a.logf("ws connected remote=%s", r.RemoteAddr)

	session := &wsSession{conn: conn, bridge: a.synap}
	a.synap.addSession(session)
	defer func() {
		a.synap.removeSession(session)
		_ = conn.Close()
		a.logf("ws disconnected remote=%s", r.RemoteAddr)
	}()

	for {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			a.logf("ws read error remote=%s err=%v", r.RemoteAddr, err)
			return
		}
		if messageType != websocket.BinaryMessage {
			continue
		}

		if response := a.dispatchWebSocket(session, payload); response != nil {
			_ = session.writeBinary(response)
		}
	}
}

func (a *App) logf(format string, args ...any) {
	if !a.cfg.logEnabled {
		return
	}
	log.Printf("diarsaba: "+format, args...)
}

func (a *App) logStartup() {
	a.logf("startup mode=%s listen_addr=%s index_path=%s request_timeout=%s", a.cfg.mode, a.cfg.listenAddr, a.cfg.indexPath, a.cfg.requestTimeout)
	if a.cfg.mode == ModeServer {
		a.logf("startup hosts public_host=%s api_host=%s", a.cfg.publicHost, a.cfg.apiHost)
	} else {
		a.logf("startup ws_path=%s", a.cfg.wsPath)
	}
	a.logf("startup synap2p mode=%s listen_port=%d listen_addrs=%v data_dir=%s key_path=%s", a.cfg.synap2p.Mode, a.cfg.synap2p.ListenPort, a.cfg.synap2p.ListenAddrs, a.cfg.synap2p.DataDir, a.cfg.synap2p.KeyPath)
	a.logf("startup samsara db_path=%s", a.cfg.samsaraDBPath)
	a.logf("startup peer_id=%s", a.node.ID())
}

func (a *App) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		wrapped := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(wrapped, r)
		a.logf("http request remote=%s method=%s host=%s path=%s status=%d bytes=%d duration=%s", r.RemoteAddr, r.Method, r.Host, r.URL.Path, wrapped.statusCode, wrapped.bytesWritten, time.Since(started).Round(time.Millisecond))
	})
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode   int
	bytesWritten int
}

func (w *loggingResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *loggingResponseWriter) Write(data []byte) (int, error) {
	bytesWritten, err := w.ResponseWriter.Write(data)
	w.bytesWritten += bytesWritten
	return bytesWritten, err
}

type wsSession struct {
	conn   *websocket.Conn
	bridge *synapBridge
	mu     sync.Mutex
}

func (s *wsSession) writeBinary(frame []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.WriteMessage(websocket.BinaryMessage, frame)
}

func stripPort(host string) string {
	if strings.Index(host, ":") == -1 {
		return host
	}
	parsedHost, _, err := net.SplitHostPort(host)
	if err == nil {
		return parsedHost
	}
	return host
}

func splitPublicPath(rawPath string) (string, string, bool) {
	trimmed := strings.TrimPrefix(rawPath, "/")
	if trimmed == "" {
		return "", "", false
	}

	parts := strings.SplitN(trimmed, "/", 2)
	if len(parts) != 2 {
		return "", "", false
	}

	dbName, err := url.PathUnescape(parts[0])
	if err != nil || strings.TrimSpace(dbName) == "" {
		return "", "", false
	}

	key, err := url.PathUnescape(parts[1])
	if err != nil || key == "" {
		return "", "", false
	}

	return dbName, key, true
}
