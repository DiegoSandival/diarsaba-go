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

export const NATIVE_OPCODE = NATIVE_OPCODES.PEERS;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.PEERS;

export function peersReqBytes(id = null) {
  return buildSinglePayloadRequest(NATIVE_OPCODE, new Uint8Array(0), id);
}

export function peersReq(message) {
  return parseSinglePayloadRequest(message, "PeersReq");
}

export function peersSuccessBytes(id) {
  return buildSuccessResponse(NATIVE_OPCODE, id);
}

export function peersErrorBytes(id) {
  return buildErrorResponse(NATIVE_OPCODE, id);
}

export function peersDataBytes(id, peers) {
  const payload = Array.isArray(peers) ? peers.join(",") : peers;
  return buildSuccessDataResponse(NATIVE_OPCODE, id, payload);
}

export function peersResult(message) {
  const parsed = parseStatusResponse(message, "PeersResult");
  if (!parsed.payload.length) {
    return parsed;
  }
  const withData = parseSuccessDataResponse(message, "PeersResultData");
  return {
    ...withData,
    peers: parsePeersCsv(withData.data)
  };
}