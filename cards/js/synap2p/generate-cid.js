import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  buildSuccessDataResponse,
  parseSinglePayloadRequest,
  parseStatusResponse,
  parseSuccessDataResponse
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.GENERATE_CID;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.GENERATE_CID;

export function generateCidReqBytes(data, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, data, id);
}

export function generateCidReq(message) {
  const parsed = parseSinglePayloadRequest(message, "GenerateCidReq");
  return { ...parsed, data: parsed.payload };
}

export function generateCidSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function generateCidErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function generateCidDataBytes(id, cid) {
  return buildSuccessDataResponse(NATIVE_OPCODE, id, cid);
}

export function generateCidResult(message) {
  const parsed = parseStatusResponse(message, "GenerateCidResult");
  if (!parsed.payload.length) {
    return parsed;
  }
  const withData = parseSuccessDataResponse(message, "GenerateCidResultData");
  return {
    ...withData,
    cid: withData.text
  };
}