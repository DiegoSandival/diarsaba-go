import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildEventPubSub,
  parseEventPubSub
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.EVENT_PUBSUB;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.EVENT_PUBSUB;

export function eventPubSubBytes(id, data) {
  return buildEventPubSub(id, data);
}

export function eventPubSub(message) {
  return parseEventPubSub(message);
}