package main

import (
	"encoding/binary"
)

type ErrorCode uint32

const (
	ErrorCodeFrameTooShort     ErrorCode = 50000
	ErrorCodeUnknownOpcode     ErrorCode = 50001
	ErrorCodeRequestTimeout    ErrorCode = 50002
	ErrorCodeDuplicateRequest  ErrorCode = 50003
	ErrorCodeNodeProcessFailed ErrorCode = 50004
)

func errorResult(id []byte, code ErrorCode, info string) []byte {
	result := make([]byte, 20+len(info))
	copy(result[:16], normalizeID(id))
	binary.BigEndian.PutUint32(result[16:20], uint32(code))
	copy(result[20:], []byte(info))
	return result
}

func normalizeID(id []byte) []byte {
	normalized := make([]byte, 16)
	copy(normalized, id)
	return normalized
}
