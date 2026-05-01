import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseSinglePayloadRequest,
  parseStatusResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.ANNOUNCE;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.ANNOUNCE;

export function announceReqBytes(cid, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, cid, id);
}

export function announceReq(message) {
  const parsed = parseSinglePayloadRequest(message, "AnnounceReq");
  return { ...parsed, cid: parsed.payload };
}

export function announceSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function announceErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function announceResult(message) {
  return parseStatusResponse(message, "AnnounceResult");
}