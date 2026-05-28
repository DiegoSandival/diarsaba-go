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

export const NATIVE_OPCODE = NATIVE_OPCODES.CRUZAR;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.CRUZAR;

export function cruzarReqBytes(dbName, cellIndexA, cellIndexB, secretA, secretB, x, y, z, childSecret, id = null) {
  const dbNameBytes = toUint8Array(dbName);
  const secretABytes = toUint8Array(secretA);
  const secretBBytes = toUint8Array(secretB);
  const childSecretBytes = toUint8Array(childSecret);

  return buildOpcodeMessage(
    NATIVE_OPCODE,
    normalizeId(id),
    u32Bytes(dbNameBytes.length),
    u32Bytes(cellIndexA),
    u32Bytes(cellIndexB),
    u32Bytes(secretABytes.length),
    u32Bytes(secretBBytes.length),
    u32Bytes(x),
    u32Bytes(y),
    u32Bytes(z),
    u32Bytes(childSecretBytes.length),
    dbNameBytes,
    secretABytes,
    secretBBytes,
    childSecretBytes
  );
}

export function cruzarReq(message) {
  const cursor = makeCursor(message);
  ensureMinLength(cursor.bytes, 56, "CruzarReq");
  cursor.skip(4, "CruzarReq opcode");

  const id = cursor.bytesSlice(16, "CruzarReq id");
  const dbNameLen = cursor.u32("CruzarReq dbNameLen");
  const cellIndexA = cursor.u32("CruzarReq cellIndexA");
  const cellIndexB = cursor.u32("CruzarReq cellIndexB");
  const secretALen = cursor.u32("CruzarReq secretALen");
  const secretBLen = cursor.u32("CruzarReq secretBLen");
  const x = cursor.u32("CruzarReq x");
  const y = cursor.u32("CruzarReq y");
  const z = cursor.u32("CruzarReq z");
  const childSecretLen = cursor.u32("CruzarReq childSecretLen");

  return {
    id,
    dbName: cursor.bytesSlice(dbNameLen, "CruzarReq dbName"),
    cellIndexA,
    cellIndexB,
    secretA: cursor.bytesSlice(secretALen, "CruzarReq secretA"),
    secretB: cursor.bytesSlice(secretBLen, "CruzarReq secretB"),
    x,
    y,
    z,
    childSecret: cursor.bytesSlice(childSecretLen, "CruzarReq childSecret")
  };
}

export function cruzarResultBytes(id, status, cellIndex) {
  return buildResultMessage(id, u32Bytes(status), u32Bytes(cellIndex));
}

export function cruzarResult(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 24, "CruzarResult");
  return {
    id: bytes.slice(0, 16),
    status: new DataView(bytes.buffer, bytes.byteOffset + 16, 4).getUint32(0, false),
    cellIndex: new DataView(bytes.buffer, bytes.byteOffset + 20, 4).getUint32(0, false)
  };
}