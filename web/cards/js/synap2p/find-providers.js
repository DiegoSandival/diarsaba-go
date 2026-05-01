import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildSinglePayloadRequest,
  buildSuccessResponse,
  buildErrorResponse,
  buildSuccessDataResponse,
  parseSinglePayloadRequest,
  parseStatusResponse,
  parseSuccessDataResponse,
  parsePeersCsv
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.FIND_PROVIDERS;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.FIND_PROVIDERS;

export function findProvidersReqBytes(cid, id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, cid, id);
}

export function findProvidersReq(message) {
  const parsed = parseSinglePayloadRequest(message, "FindProvidersReq");
  return { ...parsed, cid: parsed.payload };
}

export function findProvidersSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function findProvidersErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function findProvidersDataBytes(id, peers) {
  const payload = Array.isArray(peers) ? peers.join(",") : peers;
  return buildSuccessDataResponse(NATIVE_OPCODE, id, payload);
}

export function findProvidersResult(message) {
  const parsed = parseStatusResponse(message, "FindProvidersResult");
  if (!parsed.payload.length) {
    return parsed;
  }
  const withData = parseSuccessDataResponse(message, "FindProvidersResultData");
  return {
    ...withData,
    peers: parsePeersCsv(withData.data)
  };
}