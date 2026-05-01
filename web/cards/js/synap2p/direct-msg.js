import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildDirectMsgRequest,
  buildSuccessResponse,
  buildErrorResponse,
  parseDirectMsgRequest,
  parseStatusResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.DIRECT_MSG;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.DIRECT_MSG;

export function directMsgReqBytes(peerId, data, id = null) {
  return buildDirectMsgRequest(NATIVE_OPCODE, peerId, data, id);
}

export function directMsgReq(message) {
  return parseDirectMsgRequest(message, "DirectMsgReq");
}

export function directMsgSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function directMsgErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function directMsgResult(message) {
  return parseStatusResponse(message, "DirectMsgResult");
}