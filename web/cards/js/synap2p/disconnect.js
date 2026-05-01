import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseSinglePayloadRequest,
  parseStatusResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.DISCONNECT;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.DISCONNECT;

export function disconnectReqBytes(peerId, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, peerId, id);
}

export function disconnectReq(message) {
  const parsed = parseSinglePayloadRequest(message, "DisconnectReq");
  return { ...parsed, peerId: parsed.payload };
}

export function disconnectSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function disconnectErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function disconnectResult(message) {
  return parseStatusResponse(message, "DisconnectResult");
}