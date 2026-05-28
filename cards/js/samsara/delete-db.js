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

export const NATIVE_OPCODE = NATIVE_OPCODES.DELETE_DB;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.DELETE_DB;

export function deleteDbReqBytes(dbName, secret, cellIndex, id = null) {
  const dbNameBytes = toUint8Array(dbName);
  const secretBytes = toUint8Array(secret);
  return buildOpcodeMessage(
    NATIVE_OPCODE,
    normalizeId(id),
    u32Bytes(cellIndex),
    u32Bytes(dbNameBytes.length),
    u32Bytes(secretBytes.length),
    dbNameBytes,
    secretBytes
  );
}

export function deleteDbReq(message) {
  const cursor = makeCursor(message);
  ensureMinLength(cursor.bytes, 32, "DeleteDBReq");
  cursor.skip(4, "DeleteDBReq opcode");

  const id = cursor.bytesSlice(16, "DeleteDBReq id");
  const cellIndex = cursor.u32("DeleteDBReq cellIndex");
  const dbNameLen = cursor.u32("DeleteDBReq dbNameLen");
  const secretLen = cursor.u32("DeleteDBReq secretLen");

  return {
    id,
    cellIndex,
    dbName: cursor.bytesSlice(dbNameLen, "DeleteDBReq dbName"),
    secret: cursor.bytesSlice(secretLen, "DeleteDBReq secret")
  };
}

export function deleteDbResultBytes(id, status) {
  return buildResultMessage(id, u32Bytes(status));
}

export function deleteDbResult(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 20, "DeleteDBResult");
  return {
    id: bytes.slice(0, 16),
    status: new DataView(bytes.buffer, bytes.byteOffset + 16, 4).getUint32(0, false)
  };
}