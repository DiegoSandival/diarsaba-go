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

export const NATIVE_OPCODE = NATIVE_OPCODES.READ;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.READ;

export function readReqBytes(cellIndex, dbName, key, secret, id = null) {
  const dbNameBytes = toUint8Array(dbName);
  const keyBytes = toUint8Array(key);
  const secretBytes = toUint8Array(secret);
  return buildOpcodeMessage(
    NATIVE_OPCODE,
    normalizeId(id),
    u32Bytes(cellIndex),
    u32Bytes(dbNameBytes.length),
    u32Bytes(keyBytes.length),
    u32Bytes(secretBytes.length),
    dbNameBytes,
    keyBytes,
    secretBytes
  );
}

export function readReq(message) {
  const cursor = makeCursor(message);
  ensureMinLength(cursor.bytes, 36, "ReadReq");
  cursor.skip(4, "ReadReq opcode");

  const id = cursor.bytesSlice(16, "ReadReq id");
  const cellIndex = cursor.u32("ReadReq cellIndex");
  const dbNameLen = cursor.u32("ReadReq dbNameLen");
  const keyLen = cursor.u32("ReadReq keyLen");
  const secretLen = cursor.u32("ReadReq secretLen");

  return {
    id,
    cellIndex,
    dbName: cursor.bytesSlice(dbNameLen, "ReadReq dbName"),
    key: cursor.bytesSlice(keyLen, "ReadReq key"),
    secret: cursor.bytesSlice(secretLen, "ReadReq secret")
  };
}

export function readResultBytes(id, status, cellIndex, value) {
  return buildResultMessage(id, u32Bytes(status), u32Bytes(cellIndex), toUint8Array(value));
}

export function readResult(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 24, "ReadResult");
  return {
    id: bytes.slice(0, 16),
    status: new DataView(bytes.buffer, bytes.byteOffset + 16, 4).getUint32(0, false),
    cellIndex: new DataView(bytes.buffer, bytes.byteOffset + 20, 4).getUint32(0, false),
    value: bytes.slice(24)
  };
}