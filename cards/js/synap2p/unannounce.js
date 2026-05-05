import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseSinglePayloadRequest,
  parseStatusResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.UNANNOUNCE;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.UNANNOUNCE;

export function unannounceReqBytes(cid, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, cid, id);
}

export function unannounceReq(message) {
  const parsed = parseSinglePayloadRequest(message, "UnannounceReq");
  return { ...parsed, cid: parsed.payload };
}

export function unannounceSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function unannounceErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function unannounceResult(message) {
  return parseStatusResponse(message, "UnannounceResult");
}