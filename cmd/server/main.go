package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	samsara "github.com/DiegoSandival/samsara-go/handler"
	"github.com/DiegoSandival/samsara-go/protocol"
	quicnet "github.com/DiegoSandival/synap2p-go"
	"github.com/gorilla/websocket"
)

const (
	frameControl byte = 0x7f

	controlWelcome byte = 0x01
	controlAddr    byte = 0x02
	controlLog     byte = 0x03
	controlError   byte = 0x04

	opRelay          byte = 0x00
	opDial           byte = 0x01
	opSub            byte = 0x02
	opUse            byte = 0x03
	opPub            byte = 0x04
	opPeers          byte = 0x05
	opUnsub          byte = 0x06
	opAnnounce       byte = 0x07
	opUnannounce     byte = 0x08
	opFindProviders  byte = 0x09
	opDirectMsg      byte = 0x0a
	opDisconnect     byte = 0x0b
	opGenerateCID    byte = 0x0c
	opEventPubSub    byte = 0x0d
	opEventDirectMsg byte = 0x0e
	opEventPeerFound byte = 0x0f

	opCreateDB byte = 0x20
	opDeleteDB byte = 0x21
	opWrite    byte = 0x22
	opRead     byte = 0x23
	opReadFree byte = 0x24
	opDelete   byte = 0x25
	opReadCell byte = 0x26
	opDiferir  byte = 0x27
	opCruzar   byte = 0x28
)

type wsClient struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (c *wsClient) write(frame []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.WriteMessage(websocket.BinaryMessage, frame)
}

type app struct {
	engine        *quicnet.Engine
	samsara       *samsara.CentralHandler
	samsaraParser *protocol.ProtocolParser

	mu      sync.RWMutex
	clients map[*wsClient]struct{}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(*http.Request) bool { return true },
}

func newApp(dataDir string) (*app, error) {
	application := &app{
		samsara:       samsara.NewCentralHandler(),
		samsaraParser: &protocol.ProtocolParser{},
		clients:       make(map[*wsClient]struct{}),
	}

	keyPath := filepath.Join(dataDir, "synap2p", "client_identity.key")
	engine, err := quicnet.NewEngine(
		quicnet.WithKeyPath(keyPath),
		quicnet.WithEventHandler(func(event []byte) {
			if frame, ok := wrapSynapFrame(event); ok {
				application.broadcast(frame)
			}
		}),
		quicnet.WithLogger(func(level, msg string) {
			application.broadcastControl(controlLog, []byte(level+": "+msg))
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("create synap2p engine: %w", err)
	}

	application.engine = engine
	return application, nil
}

func (a *app) close() error {
	if a.engine == nil {
		return nil
	}
	return a.engine.Close()
}

func (a *app) addClient(client *wsClient) {
	a.mu.Lock()
	a.clients[client] = struct{}{}
	a.mu.Unlock()
}

func (a *app) removeClient(client *wsClient) {
	a.mu.Lock()
	delete(a.clients, client)
	a.mu.Unlock()
}

func (a *app) broadcast(frame []byte) {
	a.mu.RLock()
	clients := make([]*wsClient, 0, len(a.clients))
	for client := range a.clients {
		clients = append(clients, client)
	}
	a.mu.RUnlock()

	for _, client := range clients {
		if err := client.write(frame); err != nil {
			_ = client.conn.Close()
			a.removeClient(client)
		}
	}
}

func (a *app) controlFrame(kind byte, payload []byte) []byte {
	frame := make([]byte, 2+len(payload))
	frame[0] = frameControl
	frame[1] = kind
	copy(frame[2:], payload)
	return frame
}

func (a *app) broadcastControl(kind byte, payload []byte) {
	a.broadcast(a.controlFrame(kind, payload))
}

func (a *app) sendSnapshot(client *wsClient) error {
	if err := client.write(a.controlFrame(controlWelcome, []byte(a.engine.Client.ID().String()))); err != nil {
		return err
	}

	for _, addr := range a.engine.Client.Addrs() {
		if err := client.write(a.controlFrame(controlAddr, []byte(addr))); err != nil {
			return err
		}
	}

	return client.write(a.controlFrame(controlLog, []byte("socket binario listo")))
}

func (a *app) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &wsClient{conn: conn}
	a.addClient(client)
	defer func() {
		a.removeClient(client)
		_ = conn.Close()
	}()

	if err := a.sendSnapshot(client); err != nil {
		return
	}

	for {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			return
		}

		if messageType != websocket.BinaryMessage {
			if writeErr := client.write(a.controlFrame(controlError, []byte("solo se aceptan frames binarios"))); writeErr != nil {
				return
			}
			continue
		}

		if err := a.routeFrame(client, payload); err != nil {
			if writeErr := client.write(a.controlFrame(controlError, []byte(err.Error()))); writeErr != nil {
				return
			}
		}
	}
}

func (a *app) routeFrame(client *wsClient, frame []byte) error {
	if len(frame) < 1 {
		return errors.New("frame vacio")
	}

	if frame[0] == frameControl {
		return errors.New("los frames de control son solo de salida")
	}

	if len(frame) < 17 {
		return errors.New("frame demasiado corto, falta id")
	}

	externalOpcode := frame[0]
	body := frame[1:]
	nativeOpcode, domain, ok := mapExternalOpcode(externalOpcode)
	if !ok {
		return fmt.Errorf("opcode externo no soportado: 0x%02x", externalOpcode)
	}

	native := buildNativeRequest(nativeOpcode, body)
	switch domain {
	case "synap":
		a.engine.Process(native)
		return nil
	case "samsara":
		response := samsara.ProcessRequest(native, a.samsaraParser, a.samsara)
		return client.write(concat([]byte{externalOpcode}, response))
	default:
		return fmt.Errorf("dominio no soportado para opcode 0x%02x", externalOpcode)
	}
}

func buildNativeRequest(nativeOpcode byte, body []byte) []byte {
	request := make([]byte, 4+len(body))
	request[3] = nativeOpcode
	copy(request[4:], body)
	return request
}

func mapExternalOpcode(opcode byte) (nativeOpcode byte, domain string, ok bool) {
	switch opcode {
	case opRelay:
		return 0x01, "synap", true
	case opDial:
		return 0x02, "synap", true
	case opSub:
		return 0x03, "synap", true
	case opUse:
		return 0x04, "synap", true
	case opPub:
		return 0x05, "synap", true
	case opPeers:
		return 0x06, "synap", true
	case opUnsub:
		return 0x07, "synap", true
	case opAnnounce:
		return 0x08, "synap", true
	case opUnannounce:
		return 0x09, "synap", true
	case opFindProviders:
		return 0x0a, "synap", true
	case opDirectMsg:
		return 0x0b, "synap", true
	case opDisconnect:
		return 0x0c, "synap", true
	case opGenerateCID:
		return 0x0d, "synap", true
	case opCreateDB:
		return 0x00, "samsara", true
	case opDeleteDB:
		return 0x01, "samsara", true
	case opWrite:
		return 0x02, "samsara", true
	case opRead:
		return 0x03, "samsara", true
	case opReadFree:
		return 0x04, "samsara", true
	case opDelete:
		return 0x05, "samsara", true
	case opReadCell:
		return 0x06, "samsara", true
	case opDiferir:
		return 0x07, "samsara", true
	case opCruzar:
		return 0x08, "samsara", true
	default:
		return 0, "", false
	}
}

func wrapSynapFrame(native []byte) ([]byte, bool) {
	if len(native) < 20 {
		return nil, false
	}

	externalOpcode, ok := mapSynapNativeToExternal(native[3])
	if !ok {
		return nil, false
	}

	wrapped := make([]byte, 1+len(native)-4)
	wrapped[0] = externalOpcode
	copy(wrapped[1:], native[4:])
	return wrapped, true
}

func mapSynapNativeToExternal(nativeOpcode byte) (byte, bool) {
	switch nativeOpcode {
	case 0x01:
		return opRelay, true
	case 0x02:
		return opDial, true
	case 0x03:
		return opSub, true
	case 0x04:
		return opUse, true
	case 0x05:
		return opPub, true
	case 0x06:
		return opPeers, true
	case 0x07:
		return opUnsub, true
	case 0x08:
		return opAnnounce, true
	case 0x09:
		return opUnannounce, true
	case 0x0a:
		return opFindProviders, true
	case 0x0b:
		return opDirectMsg, true
	case 0x0c:
		return opDisconnect, true
	case 0x0d:
		return opGenerateCID, true
	case 0x0e:
		return opEventPubSub, true
	case 0x0f:
		return opEventDirectMsg, true
	case 0x10:
		return opEventPeerFound, true
	default:
		return 0, false
	}
}

func concat(parts ...[]byte) []byte {
	total := 0
	for _, part := range parts {
		total += len(part)
	}

	out := make([]byte, total)
	offset := 0
	for _, part := range parts {
		copy(out[offset:], part)
		offset += len(part)
	}
	return out
}

func main() {
	addr := os.Getenv("DIARSABA_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	rootDir, err := os.Getwd()
	if err != nil {
		log.Fatalf("resolve working directory: %v", err)
	}

	dataDir := filepath.Join(rootDir, "data")
	application, err := newApp(dataDir)
	if err != nil {
		log.Fatalf("initialize app: %v", err)
	}
	defer func() {
		if closeErr := application.close(); closeErr != nil {
			log.Printf("close app: %v", closeErr)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", application.handleWS)
	mux.Handle("/", http.FileServer(http.Dir(filepath.Join(rootDir, "web"))))

	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	shutdownCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		<-shutdownCtx.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()

	log.Printf("diarsaba-go escuchando en http://127.0.0.1%s", addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("http server: %v", err)
	}
}
