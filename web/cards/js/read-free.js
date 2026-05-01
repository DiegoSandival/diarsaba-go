import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildOpcodeMessage,
  buildResultMessage,
  ensureMinLength,
  makeCursor,
  normalizeId,
  toUint8Array,
  u32Bytes
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.READ_FREE;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.READ_FREE;

export function readFreeReqBytes(dbName, key, id = null) {
  const dbNameBytes = toUint8Array(dbName);
  const keyBytes = toUint8Array(key);
  return buildOpcodeMessage(
    NATIVE_OPCODE,
    normalizeId(id),
    u32Bytes(dbNameBytes.length),
    u32Bytes(keyBytes.length),
    dbNameBytes,
    keyBytes
  );
}

export function readFreeReq(message) {
  const cursor = makeCursor(message);
  ensureMinLength(cursor.bytes, 28, "ReadFreeReq");
  cursor.skip(4, "ReadFreeReq opcode");

  const id = cursor.bytesSlice(16, "ReadFreeReq id");
  const dbNameLen = cursor.u32("ReadFreeReq dbNameLen");
  const keyLen = cursor.u32("ReadFreeReq keyLen");

  return {
    id,
    dbName: cursor.bytesSlice(dbNameLen, "ReadFreeReq dbName"),
    key: cursor.bytesSlice(keyLen, "ReadFreeReq key")
  };
}

export function readFreeResultBytes(id, status, value) {
  return buildResultMessage(id, u32Bytes(status), toUint8Array(value));
}

export function readFreeResult(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 20, "ReadFreeResult");
  return {
    id: bytes.slice(0, 16),
    status: new DataView(bytes.buffer, bytes.byteOffset + 16, 4).getUint32(0, false),
    value: bytes.slice(20)
  };
}