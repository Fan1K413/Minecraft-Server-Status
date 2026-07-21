import { NextRequest, NextResponse } from "next/server";
import { StatusDatabase } from "@minecraft-status/database";
import { downsampleTrend } from "@minecraft-status/core";

export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("range") ?? "24h";
  const ranges: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };
  const rangeHours = ranges[requested];
  if (!rangeHours) return NextResponse.json({ error: "range must be 24h, 7d, or 30d" }, { status: 400 });
  const database = new StatusDatabase();
  const history = downsampleTrend(database.getHistory(rangeHours, 720), requested === "24h" ? 360 : 240);
  database.close();
  return NextResponse.json({ range: requested, history }, { headers: { "Cache-Control": "public, max-age=60" } });
}
