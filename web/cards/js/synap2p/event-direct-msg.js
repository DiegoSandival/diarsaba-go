import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildEventDirectMsg,
  parseEventDirectMsg
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.EVENT_DIRECT_MSG;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.EVENT_DIRECT_MSG;

export function eventDirectMsgBytes(id, peerId, data) {
  return buildEventDirectMsg(id, peerId, data);
}

export function eventDirectMsg(message) {
  return parseEventDirectMsg(message);
}