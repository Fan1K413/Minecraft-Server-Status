import { NextRequest, NextResponse } from "next/server";
import net from "node:net";
import dgram from "node:dgram";
import { loadServerConfig } from "@minecraft-status/config";

export const runtime = "nodejs";
const cooldown = new Map<string, number>();
const COOLDOWN_MS = 20_000;

function sourceIp(request: NextRequest): string { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"; }
function tcpCheck(host: string, port: number, timeoutMs: number): Promise<boolean> { return new Promise((resolve) => { const socket = net.connect({ host, port }); const done = (value: boolean) => { socket.destroy(); resolve(value); }; socket.once("connect", () => done(true)); socket.once("error", () => done(false)); socket.setTimeout(timeoutMs, () => done(false)); }); }
function udpCheck(host: string, port: number, timeoutMs: number): Promise<boolean> { return new Promise((resolve) => { const socket = dgram.createSocket("udp4"); const packet = Buffer.concat([Buffer.from([0x01]), Buffer.alloc(8), Buffer.from("00ffff00fefefefefdfdfdfd12345678", "hex"), Buffer.alloc(8)]); const done = (value: boolean) => { socket.close(); resolve(value); }; const timer = setTimeout(() => done(false), timeoutMs); socket.once("message", (message) => { clearTimeout(timer); done(message.length > 35 && message[0] === 0x1c); }); socket.once("error", () => { clearTimeout(timer); done(false); }); socket.send(packet, port, host, (error) => { if (error) { clearTimeout(timer); done(false); } }); }); }

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 128) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid request" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Object.keys(body as object).length !== 1 || !["JAVA", "BEDROCK", "all"].includes((body as { scope?: string }).scope ?? "")) return NextResponse.json({ error: "invalid scope" }, { status: 400 });
  const scope = (body as { scope: "JAVA" | "BEDROCK" | "all" }).scope;
  const editions = scope === "all" ? ["JAVA", "BEDROCK"] as const : [scope] as const;
  const key = `${sourceIp(request)}:${scope}`; const previous = cooldown.get(key) ?? 0; const now = Date.now();
  if (now - previous < COOLDOWN_MS) return NextResponse.json({ error: "too many checks" }, { status: 429, headers: { "Retry-After": String(Math.ceil((COOLDOWN_MS - (now - previous)) / 1000)) } });
  const config = await loadServerConfig();
  const started = performance.now();
  const results = Object.fromEntries((await Promise.all(editions.map(async (edition) => {
    const endpoint = edition === "JAVA" ? config.java : config.bedrock;
    if (!endpoint?.enabled) return [edition, null] as const;
    const success = edition === "JAVA" ? await tcpCheck(endpoint.host, endpoint.port, config.monitor.timeoutMs) : await udpCheck(endpoint.host, endpoint.port, config.monitor.timeoutMs);
    return [edition, { success, latencyMs: Math.round(performance.now() - started) }] as const;
  }))).filter((entry): entry is ["JAVA" | "BEDROCK", { success: boolean; latencyMs: number }] => entry[1] !== null));
  cooldown.set(key, now);
  const single = scope === "all" ? null : results[scope];
  return NextResponse.json(scope === "all" ? { scope, checkedAt: new Date().toISOString(), results } : { edition: scope, ...single, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
