import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildOpcodeMessage,
  buildResultMessage,
  cellBytes,
  cellFromBytes,
  ensureMinLength,
  makeCursor,
  normalizeId,
  toUint8Array,
  u32Bytes
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.READ_CELL;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.READ_CELL;

export function readCellReqBytes(dbName, secret, cellIndex, id = null) {
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

export function readCellReq(message) {
  const cursor = makeCursor(message);
  ensureMinLength(cursor.bytes, 32, "ReadCellReq");
  cursor.skip(4, "ReadCellReq opcode");

  const id = cursor.bytesSlice(16, "ReadCellReq id");
  const cellIndex = cursor.u32("ReadCellReq cellIndex");
  const dbNameLen = cursor.u32("ReadCellReq dbNameLen");
  const secretLen = cursor.u32("ReadCellReq secretLen");

  return {
    id,
    cellIndex,
    dbName: cursor.bytesSlice(dbNameLen, "ReadCellReq dbName"),
    secret: cursor.bytesSlice(secretLen, "ReadCellReq secret")
  };
}

export function readCellResultBytes(id, status, value) {
  const payload = value && !(value instanceof Uint8Array) && typeof value === "object" ? cellBytes(value) : toUint8Array(value);
  return buildResultMessage(id, u32Bytes(status), payload);
}

export function readCellResult(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 20, "ReadCellResult");
  const value = bytes.slice(20);
  return {
    id: bytes.slice(0, 16),
    status: new DataView(bytes.buffer, bytes.byteOffset + 16, 4).getUint32(0, false),
    value,
    cell: value.length >= 16 ? cellFromBytes(value) : null
  };
}