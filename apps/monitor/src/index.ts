import { pingJava as fetchJavaStatus, JavaPingError } from "@minecraft-status/java-ping";
import dgram from "node:dgram";
import { loadServerConfig } from "@minecraft-status/config";
import { normalizeMotd, motdText } from "@minecraft-status/core";
import { StatusDatabase, type JavaDetails } from "@minecraft-status/database";

const config = await loadServerConfig();
const database = new StatusDatabase();
let stopping = false;

interface ProbeSuccess { success: true; java?: JavaDetails; }
interface ProbeFailure { success: false; errorCode: string; }
type ProbeResult = ProbeSuccess | ProbeFailure;

async function pingJava(host: string, port: number, timeoutMs: number): Promise<ProbeResult> {
  const started = performance.now();
  try {
    const data = await fetchJavaStatus(host, port, timeoutMs);
    const motdParts = normalizeMotd(data.description);
    return { success: true, java: {
      playersOnline: Number(data.players?.online ?? 0), playersMax: Number(data.players?.max ?? 0),
      versionName: String(data.version?.name ?? "未知"), latencyMs: Math.round(performance.now() - started),
      motd: motdText(motdParts), motdParts, favicon: typeof data.favicon === "string" && data.favicon.length <= 100_000 ? data.favicon : null,
    }};
  } catch (error) {
    return { success: false, errorCode: error instanceof JavaPingError && error.code === "TIMEOUT" ? "TIMEOUT" : "JAVA_PING_FAILED" };
  }
}

async function pingBedrock(host: string, port: number, timeoutMs: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const clientId = Buffer.alloc(8); clientId.writeBigInt64BE(BigInt(Date.now()));
    const packet = Buffer.concat([Buffer.from([0x01]), Buffer.alloc(8), Buffer.from("00ffff00fefefefefdfdfdfd12345678", "hex"), clientId]);
    const done = (result: ProbeResult) => { socket.close(); resolve(result); };
    const timer = setTimeout(() => done({ success: false, errorCode: "TIMEOUT" }), timeoutMs);
    socket.once("error", () => { clearTimeout(timer); done({ success: false, errorCode: "BEDROCK_PING_FAILED" }); });
    socket.once("message", (message) => {
      clearTimeout(timer);
      done(message.length > 35 && message[0] === 0x1c ? { success: true } : { success: false, errorCode: "INVALID_RESPONSE" });
    });
    socket.send(packet, port, host, (error) => { if (error) { clearTimeout(timer); done({ success: false, errorCode: "BEDROCK_PING_FAILED" }); } });
  });
}

async function checkOnce(): Promise<void> {
  const checkedAt = new Date();
  if (config.java?.enabled) {
    const result = await pingJava(config.java.host, config.java.port, config.monitor.timeoutMs);
    database.recordCheck({ edition: "JAVA", checkedAt, ...result }, config.monitor);
  }
  if (config.bedrock?.enabled) {
    const result = await pingBedrock(config.bedrock.host, config.bedrock.port, config.monitor.timeoutMs);
    database.recordCheck({ edition: "BEDROCK", checkedAt, ...result }, config.monitor);
  }
  database.prune(config.monitor.retentionDays);
  console.log(JSON.stringify({ event: "monitor.check.complete", checkedAt }));
}

async function run(): Promise<void> {
  while (!stopping) {
    await checkOnce().catch((error) => console.error("monitor check failed", error));
    await new Promise((resolve) => setTimeout(resolve, config.monitor.intervalSeconds * 1_000));
  }
  database.close();
}

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
await run();
