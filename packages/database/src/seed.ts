import { normalizeMotd, motdText } from "@minecraft-status/core";
import { StatusDatabase } from "./index.js";

const database = new StatusDatabase();
const now = new Date();
for (let index = 24; index >= 0; index -= 1) {
  const checkedAt = new Date(now.getTime() - index * 3_600_000);
  const motdParts = normalizeMotd({ text: "欢迎来到", color: "green", extra: [{ text: "服务器", color: "gold", bold: true }] });
  database.recordCheck({
    edition: "JAVA", checkedAt, success: true,
    java: { playersOnline: 8 + Math.round(Math.sin(index / 3) * 5), playersMax: 80, versionName: "1.21.x", latencyMs: 32 + index % 12, motd: motdText(motdParts), motdParts, favicon: null },
  }, { downAfterFailures: 3, upAfterSuccesses: 2 });
  database.recordCheck({ edition: "BEDROCK", checkedAt, success: true }, { downAfterFailures: 3, upAfterSuccesses: 2 });
}
database.close();
console.log("Demo status data created.");
