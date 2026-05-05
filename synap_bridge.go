package main

import (
	"context"
	"sync"
	"time"

	quicnet "github.com/DiegoSandival/synap2p-go"
)

type synapBridge struct {
	node    *quicnet.Node
	timeout time.Duration

	mu       sync.Mutex
	pending  map[string]pendingRequest
	sessions map[*wsSession]struct{}
}

type pendingRequest struct {
	httpResponse chan []byte
	session      *wsSession
}

func newSynapBridge(node *quicnet.Node, timeout time.Duration) *synapBridge {
	return &synapBridge{
		node:     node,
		timeout:  timeout,
		pending:  make(map[string]pendingRequest),
		sessions: make(map[*wsSession]struct{}),
	}
}

func (b *synapBridge) Start(ctx context.Context) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case frame, ok := <-b.node.Events():
				if !ok {
					return
				}
				b.routeFrame(frame)
			}
		}
	}()
}

func (b *synapBridge) Request(frame []byte) []byte {
	requestID := requestIDFromFrame(frame)
	key := requestKey(requestID)
	responseCh := make(chan []byte, 1)
	if !b.registerPending(key, pendingRequest{httpResponse: responseCh}) {
		return errorResult(requestID, ErrorCodeDuplicateRequest, "synap.pending_duplicate")
	}

	if err := b.node.Process(frame); err != nil {
		b.removePending(key)
		return errorResult(requestID, ErrorCodeNodeProcessFailed, err.Error())
	}

	timer := time.NewTimer(b.timeout)
	defer timer.Stop()

	select {
	case response := <-responseCh:
		return response
	case <-timer.C:
		b.removePending(key)
		return errorResult(requestID, ErrorCodeRequestTimeout, "synap.response_timeout")
	}
}

func (b *synapBridge) DispatchToSession(session *wsSession, frame []byte) []byte {
	requestID := requestIDFromFrame(frame)
	key := requestKey(requestID)
	if !b.registerPending(key, pendingRequest{session: session}) {
		return errorResult(requestID, ErrorCodeDuplicateRequest, "synap.pending_duplicate")
	}

	if err := b.node.Process(frame); err != nil {
		b.removePending(key)
		return errorResult(requestID, ErrorCodeNodeProcessFailed, err.Error())
	}

	return nil
}

func (b *synapBridge) addSession(session *wsSession) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.sessions[session] = struct{}{}
}

func (b *synapBridge) removeSession(session *wsSession) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.sessions, session)
	for key, pending := range b.pending {
		if pending.session == session {
			delete(b.pending, key)
		}
	}
}

func (b *synapBridge) registerPending(key string, pending pendingRequest) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, exists := b.pending[key]; exists {
		return false
	}
	b.pending[key] = pending
	return true
}

func (b *synapBridge) removePending(key string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.pending, key)
}

func (b *synapBridge) routeFrame(frame []byte) {
	if opcode, ok := synapOpcodeFromFrame(frame); ok && isSynapEvent(opcode) {
		b.broadcast(frame)
		return
	}

	requestID, ok := synapResponseID(frame)
	if !ok {
		return
	}

	key := requestKey(requestID)
	pending, found := b.popPending(key)
	if !found {
		return
	}

	if pending.httpResponse != nil {
		pending.httpResponse <- frame
		return
	}

	if pending.session != nil {
		_ = pending.session.writeBinary(frame)
	}
}

func (b *synapBridge) popPending(key string) (pendingRequest, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	pending, found := b.pending[key]
	if found {
		delete(b.pending, key)
	}
	return pending, found
}

func (b *synapBridge) broadcast(frame []byte) {
	b.mu.Lock()
	sessions := make([]*wsSession, 0, len(b.sessions))
	for session := range b.sessions {
		sessions = append(sessions, session)
	}
	b.mu.Unlock()

	for _, session := range sessions {
		_ = session.writeBinary(frame)
	}
}

func requestKey(id []byte) string {
	return string(normalizeID(id))
}
