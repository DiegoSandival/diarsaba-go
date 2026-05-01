import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseSinglePayloadRequest,
  parseStatusResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.SUB;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.SUB;

export function subReqBytes(topic, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, topic, id);
}

export function subReq(message) {
  const parsed = parseSinglePayloadRequest(message, "SubReq");
  return { ...parsed, topic: parsed.payload };
}

export function subSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function subErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function subResult(message) {
  return parseStatusResponse(message, "SubResult");
}