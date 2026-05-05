package main

import (
	samsaraProtocol "github.com/DiegoSandival/samsara-go/protocol"
	quicnet "github.com/DiegoSandival/synap2p-go"
)

type dispatchTarget int

const (
	dispatchTargetUnknown dispatchTarget = iota
	dispatchTargetSynap
	dispatchTargetSamsara
)

func (t dispatchTarget) String() string {
	switch t {
	case dispatchTargetSynap:
		return "synap2p"
	case dispatchTargetSamsara:
		return "samsara"
	default:
		return "unknown"
	}
}

func classifyFrame(frame []byte) (dispatchTarget, byte, []byte, []byte) {
	requestID := requestIDFromFrame(frame)
	if len(frame) < 20 {
		return dispatchTargetUnknown, 0, requestID, errorResult(requestID, ErrorCodeFrameTooShort, "dispatcher.frame_too_short")
	}

	opcode := frame[3]
	switch {
	case opcode >= quicnet.OpcodeRequestMin && opcode <= quicnet.OpcodeRequestMax:
		return dispatchTargetSynap, opcode, requestID, nil
	case opcode >= samsaraProtocol.OpcodeNamespaceMin && opcode <= samsaraProtocol.OpcodeNamespaceMax:
		return dispatchTargetSamsara, opcode, requestID, nil
	default:
		return dispatchTargetUnknown, opcode, requestID, errorResult(requestID, ErrorCodeUnknownOpcode, "dispatcher.unknown_opcode")
	}
}

func requestIDFromFrame(frame []byte) []byte {
	id := make([]byte, 16)
	if len(frame) <= 4 {
		return id
	}

	end := 20
	if len(frame) < end {
		end = len(frame)
	}
	copy(id, frame[4:end])
	return id
}

func synapResponseID(frame []byte) ([]byte, bool) {
	if len(frame) < 20 {
		return nil, false
	}

	if opcode, ok := synapOpcodeFromFrame(frame); ok {
		_ = opcode
		id := make([]byte, 16)
		copy(id, frame[4:20])
		return id, true
	}

	id := make([]byte, 16)
	copy(id, frame[:16])
	return id, true
}

func synapOpcodeFromFrame(frame []byte) (byte, bool) {
	if len(frame) < 4 {
		return 0, false
	}
	if frame[0] != 0x00 || frame[1] != 0x00 || frame[2] != 0x00 {
		return 0, false
	}
	opcode := frame[3]
	if opcode >= quicnet.OpcodeRequestMin && opcode <= quicnet.OpcodeEventMax {
		return opcode, true
	}
	return 0, false
}

func isSynapEvent(opcode byte) bool {
	return opcode >= quicnet.OpcodeEventMin && opcode <= quicnet.OpcodeEventMax
}
