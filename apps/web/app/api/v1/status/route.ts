import { NextResponse } from "next/server";
import { getDashboardData } from "../../../../lib";

export const dynamic = "force-dynamic";
export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json({
    overallStatus: data.overall, checkedAt: data.checkedAt, configurationError: data.configurationError,
    server: data.config ? { name: data.config.server.name, java: data.config.java ? { enabled: data.config.java.enabled, displayAddress: data.config.java.displayAddress } : null, bedrock: data.config.bedrock ? { enabled: data.config.bedrock.enabled, displayAddress: data.config.bedrock.displayAddress } : null } : null,
    java: data.java, bedrock: data.bedrock, availability: data.availability,
  }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=30", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" } });
}
