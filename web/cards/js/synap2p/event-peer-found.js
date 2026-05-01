import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildEventPeerFound,
  parseEventPeerFound
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.EVENT_PEER_FOUND;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.EVENT_PEER_FOUND;

export function eventPeerFoundBytes(peerId) {
  return buildEventPeerFound(peerId);
}

export function eventPeerFound(message) {
  return parseEventPeerFound(message);
}