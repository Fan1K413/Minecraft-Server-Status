import { NextRequest, NextResponse } from "next/server";
import { pingJava } from "@minecraft-status/java-ping";
import dgram from "node:dgram";
import { randomUUID } from "node:crypto";
import { loadServerConfig } from "@minecraft-status/config";
import { isAllowedProbeOrigin } from "../../../../probe-origin";

export const runtime = "nodejs";
const cooldown = new Map<string, number>();
const COOLDOWN_MS = 20_000;

function sourceIp(request: NextRequest): string { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"; }
function headers(requestId: string, extra: HeadersInit = {}): Headers { return new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Request-ID": requestId, ...extra }); }
function response(requestId: string, body: Record<string, unknown>, status = 200, extra: HeadersInit = {}): NextResponse { return NextResponse.json({ ...body, requestId }, { status, headers: headers(requestId, extra) }); }
function log(event: string, fields: Record<string, unknown>): void { console.info(JSON.stringify({ event, ...fields })); }
function javaCheck(host: string, port: number, timeoutMs: number): Promise<boolean> { return pingJava(host, port, timeoutMs).then(() => true).catch(() => false); }
function udpCheck(host: string, port: number, timeoutMs: number): Promise<boolean> { return new Promise((resolve) => { const socket = dgram.createSocket("udp4"); let doneOnce = false; const packet = Buffer.concat([Buffer.from([0x01]), Buffer.alloc(8), Buffer.from("00ffff00fefefefefdfdfdfd12345678", "hex"), Buffer.alloc(8)]); const done = (value: boolean) => { if (doneOnce) return; doneOnce = true; socket.close(); resolve(value); }; const timer = setTimeout(() => done(false), timeoutMs); socket.once("message", (message) => { clearTimeout(timer); done(message.length > 35 && message[0] === 0x1c); }); socket.once("error", () => { clearTimeout(timer); done(false); }); socket.send(packet, port, host, (error) => { if (error) { clearTimeout(timer); done(false); } }); }); }

export async function POST(request: NextRequest) {
  const requestId = randomUUID(); const started = performance.now(); const origin = request.headers.get("origin");
  if (!isAllowedProbeOrigin(origin)) { log("probe.rejected", { requestId, reason: "origin", origin, host: request.headers.get("host"), forwardedHost: request.headers.get("x-forwarded-host") }); return response(requestId, { error: "untrusted origin", code: "origin_rejected" }, 403); }
  if (Number(request.headers.get("content-length") ?? 0) > 128) return response(requestId, { error: "payload too large", code: "payload_too_large" }, 413);
  let raw: string;
  try { raw = await request.text(); } catch { return response(requestId, { error: "invalid request", code: "invalid_request" }, 400); }
  if (Buffer.byteLength(raw, "utf8") > 128) return response(requestId, { error: "payload too large", code: "payload_too_large" }, 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return response(requestId, { error: "invalid request", code: "invalid_request" }, 400); }
  if (!body || typeof body !== "object" || Object.keys(body as object).length !== 1 || !["JAVA", "BEDROCK", "all"].includes((body as { scope?: string }).scope ?? "")) return response(requestId, { error: "invalid scope", code: "invalid_scope" }, 400);
  const scope = (body as { scope: "JAVA" | "BEDROCK" | "all" }).scope; const key = `${sourceIp(request)}:${scope}`; const previous = cooldown.get(key) ?? 0; const now = Date.now();
  if (now - previous < COOLDOWN_MS) return response(requestId, { error: "too many checks", code: "rate_limited" }, 429, { "Retry-After": String(Math.ceil((COOLDOWN_MS - (now - previous)) / 1000)) });
  try {
    const config = await loadServerConfig(); const editions = scope === "all" ? ["JAVA", "BEDROCK"] as const : [scope] as const;
    const results = Object.fromEntries((await Promise.all(editions.map(async (edition) => { const endpoint = edition === "JAVA" ? config.java : config.bedrock; if (!endpoint?.enabled) return [edition, null] as const; const success = edition === "JAVA" ? await javaCheck(endpoint.host, endpoint.port, config.monitor.timeoutMs) : await udpCheck(endpoint.host, endpoint.port, config.monitor.timeoutMs); return [edition, { success, latencyMs: Math.round(performance.now() - started) }] as const; }))).filter((entry): entry is ["JAVA" | "BEDROCK", { success: boolean; latencyMs: number }] => entry[1] !== null));
    cooldown.set(key, now); log("probe.completed", { requestId, scope, status: 200, elapsedMs: Math.round(performance.now() - started) });
    const single = scope === "all" ? null : results[scope]; return response(requestId, scope === "all" ? { scope, checkedAt: new Date().toISOString(), results } : { edition: scope, ...single, checkedAt: new Date().toISOString() });
  } catch (error) { log("probe.unavailable", { requestId, scope, message: error instanceof Error ? error.message.slice(0, 120) : "unknown" }); return response(requestId, { error: "probe unavailable", code: "probe_unavailable" }, 503); }
}
