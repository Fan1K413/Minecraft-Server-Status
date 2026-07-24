import net from "node:net";

const MAX_FRAME_BYTES = 1_048_576;
const MAX_VAR_INT_BYTES = 5;

export interface JavaStatusResponse {
  players?: { online?: number; max?: number };
  version?: { name?: string };
  description?: unknown;
  favicon?: string;
}

export class JavaPingError extends Error {
  constructor(message: string, readonly code: "TIMEOUT" | "PROTOCOL") { super(message); }
}

export async function pingJava(host: string, port: number, timeoutMs: number): Promise<JavaStatusResponse> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new JavaPingError("Invalid port", "PROTOCOL");
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }); let settled = false; let buffer = Buffer.alloc(0);
    const done = (error?: Error, value?: JavaStatusResponse) => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); error ? reject(error) : resolve(value!); };
    const timer = setTimeout(() => done(new JavaPingError("Timed out", "TIMEOUT")), timeoutMs);
    socket.once("error", () => done(new JavaPingError("Connection failed", "PROTOCOL")));
    socket.once("connect", () => socket.write(Buffer.concat([frame(Buffer.concat([varInt(0), varInt(255), string(host), unsignedShort(port), varInt(1)])), frame(varInt(0))])));
    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_FRAME_BYTES + MAX_VAR_INT_BYTES) return done(new JavaPingError("Response too large", "PROTOCOL"));
      try {
        const length = readVarInt(buffer, 0); if (!length || buffer.length < length.bytes + length.value) return;
        const packet = buffer.subarray(length.bytes, length.bytes + length.value); const id = readVarInt(packet, 0);
        if (!id || id.value !== 0) return done(new JavaPingError("Unexpected response packet", "PROTOCOL"));
        const json = readString(packet, id.bytes); if (!json || id.bytes + json.bytes !== packet.length) return done(new JavaPingError("Malformed status response", "PROTOCOL"));
        const value = JSON.parse(json.value) as JavaStatusResponse;
        if (!value || typeof value !== "object") return done(new JavaPingError("Invalid status response", "PROTOCOL"));
        done(undefined, value);
      } catch { done(new JavaPingError("Malformed status response", "PROTOCOL")); }
    });
  });
}

function frame(payload: Buffer): Buffer { return Buffer.concat([varInt(payload.length), payload]); }
function varInt(value: number): Buffer { const bytes: number[] = []; do { let current = value & 0x7f; value >>>= 7; if (value) current |= 0x80; bytes.push(current); } while (value); return Buffer.from(bytes); }
function unsignedShort(value: number): Buffer { const buffer = Buffer.alloc(2); buffer.writeUInt16BE(value); return buffer; }
function string(value: string): Buffer { const text = Buffer.from(value, "utf8"); if (text.length > 255) throw new JavaPingError("Host too long", "PROTOCOL"); return Buffer.concat([varInt(text.length), text]); }
function readVarInt(buffer: Buffer, offset: number): { value: number; bytes: number } | null { let value = 0; for (let index = 0; index < MAX_VAR_INT_BYTES; index += 1) { const byte = buffer[offset + index]; if (byte === undefined) return null; value |= (byte & 0x7f) << (index * 7); if (!(byte & 0x80)) return { value, bytes: index + 1 }; } throw new JavaPingError("VarInt too long", "PROTOCOL"); }
function readString(buffer: Buffer, offset: number): { value: string; bytes: number } | null { const length = readVarInt(buffer, offset); if (!length) return null; if (length.value < 0 || length.value > MAX_FRAME_BYTES || buffer.length < offset + length.bytes + length.value) return null; return { value: buffer.subarray(offset + length.bytes, offset + length.bytes + length.value).toString("utf8"), bytes: length.bytes + length.value }; }
