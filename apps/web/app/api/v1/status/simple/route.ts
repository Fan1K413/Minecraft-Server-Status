import { NextResponse } from "next/server";
import { getDashboardData } from "../../../../../lib";

export const dynamic = "force-dynamic";
export async function GET() {
  const data = await getDashboardData();
  const java = data.config?.java?.enabled ? data.java?.status ?? "UNKNOWN" : null;
  const bedrock = data.config?.bedrock?.enabled ? data.bedrock?.status ?? "UNKNOWN" : null;
  return NextResponse.json({ status: data.overall, checkedAt: data.checkedAt, stale: data.overall === "UNKNOWN", endpoints: { java, bedrock } }, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30", "X-Content-Type-Options": "nosniff", "Access-Control-Allow-Origin": "*" } });
}
