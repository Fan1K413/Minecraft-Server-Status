import { getDashboardData } from "../../../../lib";

export const dynamic = "force-dynamic";

const appearance: Record<string, { color: string; label: string }> = {
  OPERATIONAL: { color: "#27b866", label: "运行正常" },
  PARTIAL_OUTAGE: { color: "#eea52c", label: "部分可用" },
  OUTAGE: { color: "#ef4f48", label: "暂时离线" },
  MAINTENANCE: { color: "#eea52c", label: "计划维护" },
  UNKNOWN: { color: "#94a09a", label: "状态未知" },
};

export async function GET() {
  const data = await getDashboardData();
  const current = appearance[data.overall] ?? appearance.UNKNOWN;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="132" height="28" viewBox="0 0 132 28" role="img" aria-label="${current.label}"><rect width="132" height="28" rx="5" fill="#ffffff" stroke="#dce2dc"/><circle cx="16" cy="14" r="6" fill="${current.color}"/><text x="29" y="18" fill="#17201a" font-family="Arial, Microsoft YaHei, sans-serif" font-size="13">${current.label}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=30, stale-while-revalidate=60", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400" } }); }
