import {
  buildOpcodeMessage,
  normalizeId,
  readU32,
  toUint8Array,
  u16Bytes,
  utf8Text,
  ensureMinLength
} from "../common.js";

export const NATIVE_OPCODES = {
  RELAY: 0x01,
  DIAL: 0x02,
  SUB: 0x03,
  USE: 0x04,
  PUB: 0x05,
  PEERS: 0x06,
  UNSUB: 0x07,
  ANNOUNCE: 0x08,
  UNANNOUNCE: 0x09,
  FIND_PROVIDERS: 0x0a,
  DIRECT_MSG: 0x0b,
  DISCONNECT: 0x0c,
  GENERATE_CID: 0x0d,
  EVENT_PUBSUB: 0x0e,
  EVENT_DIRECT_MSG: 0x0f,
  EVENT_PEER_FOUND: 0x10
};

export const EXTERNAL_OPCODES = {
  RELAY: 0x00,
  DIAL: 0x01,
  SUB: 0x02,
  USE: 0x03,
  PUB: 0x04,
  PEERS: 0x05,
  UNSUB: 0x06,
  ANNOUNCE: 0x07,
  UNANNOUNCE: 0x08,
  FIND_PROVIDERS: 0x09,
  DIRECT_MSG: 0x0a,
  DISCONNECT: 0x0b,
  GENERATE_CID: 0x0c,
  EVENT_PUBSUB: 0x0d,
  EVENT_DIRECT_MSG: 0x0e,
  EVENT_PEER_FOUND: 0x0f
};

export function buildSinglePayloadRequest(opcode, payload, id = null) {
  return buildOpcodeMessage(opcode, normalizeId(id), toUint8Array(payload));
}

export function parseSinglePayloadRequest(message, label) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 20, label);
  return {
    opcode: readU32(bytes, 0) & 0xff,
    id: bytes.slice(4, 20),
    payload: bytes.slice(20)
  };
}

export function buildStatusResponse(opcode, id, ok) {
  const out = new Uint8Array(21);
  out[3] = opcode;
  out.set(normalizeId(id), 4);
  out[20] = ok ? 0x01 : 0x00;
  return out;
}

export function buildSuccessResponse(opcode, id) {
  return buildStatusResponse(opcode, id, true);
}

export function buildErrorResponse(opcode, id) {
  return buildStatusResponse(opcode, id, false);
}

export function parseStatusResponse(message, label) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 21, label);
  return {
    opcode: readU32(bytes, 0) & 0xff,
    id: bytes.slice(4, 20),
    status: bytes[20],
    ok: bytes[20] === 0x01,
    payload: bytes.slice(21)
  };
}

export function buildSuccessDataResponse(opcode, id, data) {
  const payload = toUint8Array(data);
  const out = new Uint8Array(21 + payload.length);
  out[3] = opcode;
  out.set(normalizeId(id), 4);
  out[20] = 0x01;
  out.set(payload, 21);
  return out;
}

export function parseSuccessDataResponse(message, label) {
  const parsed = parseStatusResponse(message, label);
  return {
    ...parsed,
    data: parsed.payload,
    text: utf8Text(parsed.payload)
  };
}

export function buildDirectMsgRequest(opcode, peerId, data, id = null) {
  const peerBytes = toUint8Array(peerId);
  const dataBytes = toUint8Array(data);
  return buildOpcodeMessage(opcode, normalizeId(id), u16Bytes(peerBytes.length), peerBytes, dataBytes);
}

export function parseDirectMsgRequest(message, label) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 22, label);
  const peerLength = (bytes[20] << 8) | bytes[21];
  ensureMinLength(bytes, 22 + peerLength, label + " peer");
  return {
    opcode: readU32(bytes, 0) & 0xff,
    id: bytes.slice(4, 20),
    peerId: bytes.slice(22, 22 + peerLength),
    data: bytes.slice(22 + peerLength)
  };
}

export function buildEventPubSub(id, data) {
  return buildOpcodeMessage(NATIVE_OPCODES.EVENT_PUBSUB, normalizeId(id), toUint8Array(data));
}

export function parseEventPubSub(message) {
  const parsed = parseSinglePayloadRequest(message, "EventPubSub");
  return {
    ...parsed,
    data: parsed.payload,
    text: utf8Text(parsed.payload)
  };
}

export function buildEventDirectMsg(id, peerId, data) {
  const peerBytes = toUint8Array(peerId);
  const dataBytes = toUint8Array(data);
  return buildOpcodeMessage(NATIVE_OPCODES.EVENT_DIRECT_MSG, normalizeId(id), u16Bytes(peerBytes.length), peerBytes, dataBytes);
}

export function parseEventDirectMsg(message) {
  const parsed = parseDirectMsgRequest(message, "EventDirectMsg");
  return {
    ...parsed,
    peerText: utf8Text(parsed.peerId),
    dataText: utf8Text(parsed.data)
  };
}

export function buildEventPeerFound(peerId) {
  const peerBytes = toUint8Array(peerId);
  return buildOpcodeMessage(NATIVE_OPCODES.EVENT_PEER_FOUND, new Uint8Array(16), u16Bytes(peerBytes.length), peerBytes);
}

export function parseEventPeerFound(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 22, "EventPeerFound");
  const peerLength = (bytes[20] << 8) | bytes[21];
  ensureMinLength(bytes, 22 + peerLength, "EventPeerFound peer");
  const peerId = bytes.slice(22, 22 + peerLength);
  return {
    opcode: readU32(bytes, 0) & 0xff,
    id: bytes.slice(4, 20),
    peerId,
    peerText: utf8Text(peerId)
  };
}

export function parsePeersCsv(bytes) {
  const text = utf8Text(bytes);
  return text ? text.split(",").filter(Boolean) : [];
}

export function splitPubPayload(bytes) {
  const text = utf8Text(bytes);
  const separator = text.indexOf("|");
  if (separator === -1) {
    return { topic: text, message: "" };
  }
  return {
    topic: text.slice(0, separator),
    message: text.slice(separator + 1)
  };
}