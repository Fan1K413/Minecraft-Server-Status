import { NextResponse } from "next/server";
import { StatusDatabase } from "@minecraft-status/database";
export function GET() {
  try { const database = new StatusDatabase(); const ready = database.isReady(); database.close(); return NextResponse.json({ status: ready ? "ready" : "not-ready" }, { status: ready ? 200 : 503 }); }
  catch { return NextResponse.json({ status: "not-ready" }, { status: 503 }); }
}
