import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseSinglePayloadRequest,
  parseStatusResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.DIAL;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.DIAL;

export function dialReqBytes(addr, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, addr, id);
}

export function dialReq(message) {
  const parsed = parseSinglePayloadRequest(message, "DialReq");
  return { ...parsed, addr: parsed.payload };
}

export function dialSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function dialErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function dialResult(message) {
  return parseStatusResponse(message, "DialResult");
}