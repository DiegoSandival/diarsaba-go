import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseSinglePayloadRequest,
  parseStatusResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.USE;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.USE;

export function useReqBytes(topic, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, topic, id);
}

export function useReq(message) {
  const parsed = parseSinglePayloadRequest(message, "UseReq");
  return { ...parsed, topic: parsed.payload };
}

export function useSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function useErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function useResult(message) {
  return parseStatusResponse(message, "UseResult");
}