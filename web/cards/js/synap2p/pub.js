import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseSinglePayloadRequest,
  parseStatusResponse,
  splitPubPayload
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.PUB;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.PUB;

export function pubPayloadBytes(topic, message) {
  return topic + "|" + (message || "");
}

export function pubReqBytes(topic, message, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, pubPayloadBytes(topic, message), id);
}

export function pubReq(message) {
  const parsed = parseSinglePayloadRequest(message, "PubReq");
  return { ...parsed, ...splitPubPayload(parsed.payload) };
}

export function pubSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function pubErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function pubResult(message) {
  return parseStatusResponse(message, "PubResult");
}