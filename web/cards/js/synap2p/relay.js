import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseSinglePayloadRequest,
  parseStatusResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.RELAY;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.RELAY;

export function relayReqBytes(addr, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, addr, id);
}

export function relayReq(message) {
  const parsed = parseSinglePayloadRequest(message, "RelayReq");
  return { ...parsed, addr: parsed.payload };
}

export function relaySuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function relayErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function relayResult(message) {
  return parseStatusResponse(message, "RelayResult");
}