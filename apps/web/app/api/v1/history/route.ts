import { NextRequest, NextResponse } from "next/server";
import { StatusDatabase } from "@minecraft-status/database";
import { downsampleTrend, historyRangeHours, parseHistoryRange } from "@minecraft-status/core";

export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const range = parseHistoryRange(request.nextUrl.searchParams.get("range"));
  const retentionDays = 90;
  const rangeHours = range === "all" ? retentionDays * 24 : historyRangeHours[range];
  const database = new StatusDatabase();
  const maxPoints = rangeHours <= 72 ? 360 : rangeHours <= 168 ? 420 : 600;
  const history = downsampleTrend(database.getHistory(rangeHours, maxPoints), maxPoints);
  const availability = { java: database.getAvailabilityBuckets("JAVA", rangeHours), bedrock: database.getAvailabilityBuckets("BEDROCK", rangeHours) };
  database.close();
  return NextResponse.json({ range, from: new Date(Date.now() - rangeHours * 3_600_000).toISOString(), to: new Date().toISOString(), history, availability }, { headers: { "Cache-Control": "public, max-age=60", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" } });
}
