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

export const NATIVE_OPCODE = NATIVE_OPCODES.DELETE;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.DELETE;

export function deleteReqBytes(dbName, key, secret, cellIndex, id = null) {
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

export function deleteReq(message) {
  const cursor = makeCursor(message);
  ensureMinLength(cursor.bytes, 36, "DeleteReq");
  cursor.skip(4, "DeleteReq opcode");

  const id = cursor.bytesSlice(16, "DeleteReq id");
  const cellIndex = cursor.u32("DeleteReq cellIndex");
  const dbNameLen = cursor.u32("DeleteReq dbNameLen");
  const keyLen = cursor.u32("DeleteReq keyLen");
  const secretLen = cursor.u32("DeleteReq secretLen");

  return {
    id,
    cellIndex,
    dbName: cursor.bytesSlice(dbNameLen, "DeleteReq dbName"),
    key: cursor.bytesSlice(keyLen, "DeleteReq key"),
    secret: cursor.bytesSlice(secretLen, "DeleteReq secret")
  };
}

export function deleteResultBytes(id, status) {
  return buildResultMessage(id, u32Bytes(status));
}

export function deleteResult(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 20, "DeleteResult");
  return {
    id: bytes.slice(0, 16),
    status: new DataView(bytes.buffer, bytes.byteOffset + 16, 4).getUint32(0, false)
  };
}