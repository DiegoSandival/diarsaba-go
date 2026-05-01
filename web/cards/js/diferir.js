import {
  EXTERNAL_OPCODES,
  NATIVE_OPCODES,
  buildOpcodeMessage,
  buildResultMessage,
  ensureMinLength,
  makeCursor,
  normalizeId,
  randomBytes,
  toUint8Array,
  u32Bytes
} from "./common.js";

export const NATIVE_OPCODE = NATIVE_OPCODES.DIFERIR;
export const EXTERNAL_OPCODE = EXTERNAL_OPCODES.DIFERIR;

export function diferirReqBytes(dbName, secret, childSecret, cellIndex, childGenome, x, y, z, id = null, childSalt = null) {
  const dbNameBytes = toUint8Array(dbName);
  const secretBytes = toUint8Array(secret);
  const childSecretBytes = toUint8Array(childSecret);
  const saltBytes = childSalt == null ? randomBytes(16) : normalizeId(childSalt);

  return buildOpcodeMessage(
    NATIVE_OPCODE,
    normalizeId(id),
    u32Bytes(dbNameBytes.length),
    u32Bytes(cellIndex),
    u32Bytes(secretBytes.length),
    u32Bytes(childGenome),
    u32Bytes(x),
    u32Bytes(y),
    u32Bytes(z),
    saltBytes,
    u32Bytes(childSecretBytes.length),
    dbNameBytes,
    secretBytes,
    childSecretBytes
  );
}

export function diferirReq(message) {
  const cursor = makeCursor(message);
  ensureMinLength(cursor.bytes, 68, "DiferirReq");
  cursor.skip(4, "DiferirReq opcode");

  const id = cursor.bytesSlice(16, "DiferirReq id");
  const dbNameLen = cursor.u32("DiferirReq dbNameLen");
  const cellIndex = cursor.u32("DiferirReq cellIndex");
  const secretLen = cursor.u32("DiferirReq secretLen");
  const childGenome = cursor.u32("DiferirReq childGenome");
  const x = cursor.u32("DiferirReq x");
  const y = cursor.u32("DiferirReq y");
  const z = cursor.u32("DiferirReq z");
  const childSalt = cursor.bytesSlice(16, "DiferirReq childSalt");
  const childSecretLen = cursor.u32("DiferirReq childSecretLen");

  return {
    id,
    dbName: cursor.bytesSlice(dbNameLen, "DiferirReq dbName"),
    cellIndex,
    secret: cursor.bytesSlice(secretLen, "DiferirReq secret"),
    childGenome,
    x,
    y,
    z,
    childSalt,
    childSecret: cursor.bytesSlice(childSecretLen, "DiferirReq childSecret")
  };
}

export function diferirResultBytes(id, status, cellIndex) {
  return buildResultMessage(id, u32Bytes(status), u32Bytes(cellIndex));
}

export function diferirResult(message) {
  const bytes = toUint8Array(message);
  ensureMinLength(bytes, 24, "DiferirResult");
  return {
    id: bytes.slice(0, 16),
    status: new DataView(bytes.buffer, bytes.byteOffset + 16, 4).getUint32(0, false),
    cellIndex: new DataView(bytes.buffer, bytes.byteOffset + 20, 4).getUint32(0, false)
  };
}