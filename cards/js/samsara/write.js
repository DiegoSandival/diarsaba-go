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

export const NATIVE_OPCODE = NATIVE_OPCODES.WRITE;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.WRITE;

export function writeReqBytes(cellIndex, dbName, key, value, secret, id = null) {
  const dbNameBytes = toUint8Array(dbName);
  const keyBytes = toUint8Array(key);
  const valueBytes = toUint8Array(value);
  const secretBytes = toUint8Array(secret);
  return buildOpcodeMessage(
    NATIVE_OPCODE,
    normalizeId(id),
    u32Bytes(cellIndex),
    u32Bytes(dbNameBytes.length),
    u32Bytes(keyBytes.length),
    u32Bytes(valueBytes.length),
    u32Bytes(secretBytes.length),
    dbNameBytes,
    keyBytes,
    valueBytes,
    secretBytes
  );
}

export function writeReq(message) {
  const cursor = makeCursor(message);
  ensureMinLength(cursor.bytes, 40, "WriteReq");
  cursor.skip(4, "WriteReq opcode");

  const id = cursor.bytesSlice(16, "WriteReq id");
  const cellIndex = cursor.u32("WriteReq cellIndex");
  const dbNameLen = cursor.u32("WriteReq dbNameLen");
  const keyLen = cursor.u32("WriteReq keyLen");
  const valueLen = cursor.u32("WriteReq valueLen");
  const secretLen = cursor.u32("WriteReq secretLen");

  return {
    id,
    cellIndex,
    dbName: cursor.bytesSlice(dbNameLen, "WriteReq dbName"),
    key: cursor.bytesSlice(keyLen, "WriteReq key"),
    value: cursor.bytesSlice(valueLen, "WriteReq value"),
    secret: cursor.bytesSlice(secretLen, "WriteReq secret")
  };
}

export function writeResultBytes(id, status, newCellIndex = 0, newValue = new Uint8Array(0)) {
  void newCellIndex;
  void newValue;
  return buildResultMessage(id, u32Bytes(status));
}

export function writeResult(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 20, "WriteResult");
  return {
    id: bytes.slice(0, 16),
    status: new DataView(bytes.buffer, bytes.byteOffset + 16, 4).getUint32(0, false)
  };
}