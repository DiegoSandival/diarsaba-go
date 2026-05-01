import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseSinglePayloadRequest,
  parseStatusResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.UNSUB;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.UNSUB;

export function unsubReqBytes(topic, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, topic, id);
}

export function unsubReq(message) {
  const parsed = parseSinglePayloadRequest(message, "UnsubReq");
  return { ...parsed, topic: parsed.payload };
}

export function unsubSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function unsubErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function unsubResult(message) {
  return parseStatusResponse(message, "UnsubResult");
}