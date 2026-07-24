import { NextRequest, NextResponse } from "next/server";
import { StatusDatabase } from "@minecraft-status/database";
import { loadServerConfig } from "@minecraft-status/config";
import { buildTrendWindow, historyRangeHours, parseHistoryRange } from "@minecraft-status/core";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const range = parseHistoryRange(request.nextUrl.searchParams.get("range"));
  const config = await loadServerConfig();
  const database = new StatusDatabase();
  const now = new Date();
  const retentionHours = config.monitor.retentionDays * 24;
  const retentionFrom = new Date(now.getTime() - retentionHours * 3_600_000);
  const earliest = range === "all" ? database.getEarliestCheckAt("JAVA", now) : null;
  const from = range === "all" && earliest && earliest > retentionFrom ? earliest : range === "all" ? retentionFrom : new Date(now.getTime() - historyRangeHours[range] * 3_600_000);
  const rangeHours = (now.getTime() - from.getTime()) / 3_600_000;
  const maxPoints = rangeHours <= 72 ? 360 : rangeHours <= 168 ? 420 : 600;
  const history = buildTrendWindow(database.getHistory(rangeHours, now), from, now, config.monitor.intervalSeconds, maxPoints);
  const availability = { java: database.getAvailabilityBuckets("JAVA", rangeHours, 30, now), bedrock: database.getAvailabilityBuckets("BEDROCK", rangeHours, 30, now) };
  database.close();
  return NextResponse.json({ range, from: from.toISOString(), to: now.toISOString(), history, availability }, { headers: { "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" } });
}
