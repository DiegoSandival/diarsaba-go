const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const NATIVE_OPCODES = {
  CREATE_DB: 0x00,
  DELETE_DB: 0x01,
  WRITE: 0x02,
  READ: 0x03,
  READ_FREE: 0x04,
  DELETE: 0x05,
  READ_CELL: 0x06,
  DIFERIR: 0x07,
  CRUZAR: 0x08
};

export const EXTERNAL_OPCODES = {
  CREATE_DB: 0x20,
  DELETE_DB: 0x21,
  WRITE: 0x22,
  READ: 0x23,
  READ_FREE: 0x24,
  DELETE: 0x25,
  READ_CELL: 0x26,
  DIFERIR: 0x27,
  CRUZAR: 0x28
};

export const GENOME_FLAGS = [
  ["readSelf", 0],
  ["readNeighbors", 1],
  ["writeSelf", 2],
  ["writeNeighbors", 3],
  ["deleteSelf", 4],
  ["deleteNeighbors", 5],
  ["diferirSelf", 6],
  ["cruzarSelf", 7],
  ["dominanceSelf", 8],
  ["freeRead", 9],
  ["isMigrated", 10]
];

export function randomBytes(length) {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

export function cloneBytes(bytes) {
  return Uint8Array.from(toUint8Array(bytes));
}

export function toUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (typeof value === "string") {
    return encoder.encode(value);
  }
  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }
  if (value == null) {
    return new Uint8Array(0);
  }
  throw new TypeError("expected Uint8Array, ArrayBuffer, array or string");
}

export function utf8Bytes(value) {
  return encoder.encode(value || "");
}

export function utf8Text(bytes) {
  return decoder.decode(toUint8Array(bytes));
}

export function hex(bytes) {
  return Array.from(toUint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ensureMinLength(bytes, minLength, label) {
  if (bytes.length < minLength) {
    throw new Error(label + ": mensaje demasiado corto");
  }
}

export function u16Bytes(value) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, Number(value) >>> 0, false);
  return out;
}

export function u32Bytes(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, Number(value) >>> 0, false);
  return out;
}

export function readU32(bytes, offset) {
  ensureMinLength(bytes, offset + 4, "readU32");
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

export function concatBytes(...parts) {
  const normalized = parts.map((part) => toUint8Array(part));
  const total = normalized.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of normalized) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function buildOpcodeMessage(opcode, ...parts) {
  return concatBytes(u32Bytes(opcode), ...parts);
}

export function buildResultMessage(id, ...parts) {
  return concatBytes(normalizeId(id), ...parts);
}

export function normalizeId(id) {
  const raw = id == null ? randomBytes(16) : toUint8Array(id);
  if (raw.length !== 16) {
    throw new Error("id debe tener 16 bytes");
  }
  return raw;
}

export function makeCursor(input) {
  const bytes = toUint8Array(input);
  let offset = 0;

  return {
    bytes,
    get offset() {
      return offset;
    },
    skip(length, label = "cursor") {
      ensureMinLength(bytes, offset + length, label);
      offset += length;
    },
    u32(label = "cursor") {
      ensureMinLength(bytes, offset + 4, label);
      const value = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
      offset += 4;
      return value;
    },
    bytesSlice(length, label = "cursor") {
      ensureMinLength(bytes, offset + length, label);
      const value = bytes.slice(offset, offset + length);
      offset += length;
      return value;
    },
    rest() {
      return bytes.slice(offset);
    }
  };
}

export function cellBytes(cell) {
  return concatBytes(
    u32Bytes(cell.genome ?? cell.Genoma ?? 0),
    u32Bytes(cell.x ?? cell.X ?? 0),
    u32Bytes(cell.y ?? cell.Y ?? 0),
    u32Bytes(cell.z ?? cell.Z ?? 0)
  );
}

export function cellFromBytes(bytes) {
  const raw = toUint8Array(bytes);
  ensureMinLength(raw, 16, "cellFromBytes");
  return {
    genome: readU32(raw, 0),
    x: readU32(raw, 4),
    y: readU32(raw, 8),
    z: readU32(raw, 12)
  };
}

export function genomeDetailFromUint32(genome) {
  return Object.fromEntries(GENOME_FLAGS.map(([name, bit]) => [name, (genome & (1 << bit)) !== 0]));
}

export function genomeUint32FromDetail(detail) {
  let genome = 0;
  for (const [name, bit] of GENOME_FLAGS) {
    if (detail && detail[name]) {
      genome |= 1 << bit;
    }
  }
  return genome >>> 0;
}