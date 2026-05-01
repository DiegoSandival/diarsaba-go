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

export const NATIVE_OPCODE = NATIVE_OPCODES.CREATE_DB;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.CREATE_DB;

export function createDbReqBytes(dbName, secret, dbSize, genome, id = null) {
  const dbNameBytes = toUint8Array(dbName);
  const secretBytes = toUint8Array(secret);
  return buildOpcodeMessage(
    NATIVE_OPCODE,
    normalizeId(id),
    u32Bytes(dbNameBytes.length),
    u32Bytes(secretBytes.length),
    u32Bytes(dbSize),
    u32Bytes(genome),
    dbNameBytes,
    secretBytes
  );
}

export function createDbReq(message) {
  const cursor = makeCursor(message);
  ensureMinLength(cursor.bytes, 36, "CreateDBReq");
  cursor.skip(4, "CreateDBReq opcode");

  const id = cursor.bytesSlice(16, "CreateDBReq id");
  const dbNameLen = cursor.u32("CreateDBReq dbNameLen");
  const secretLen = cursor.u32("CreateDBReq secretLen");
  const dbSize = cursor.u32("CreateDBReq dbSize");
  const genome = cursor.u32("CreateDBReq genome");

  return {
    id,
    dbName: cursor.bytesSlice(dbNameLen, "CreateDBReq dbName"),
    secret: cursor.bytesSlice(secretLen, "CreateDBReq secret"),
    dbSize,
    genome
  };
}

export function createDbResultBytes(id, status) {
  return buildResultMessage(id, u32Bytes(status));
}

export function createDbResult(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 20, "CreateDBResult");
  return {
    id: bytes.slice(0, 16),
    status: new DataView(bytes.buffer, bytes.byteOffset + 16, 4).getUint32(0, false)
  };
}