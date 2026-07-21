import { getDashboardData } from "../../../../lib";

export const dynamic = "force-dynamic";

const appearance: Record<string, { color: string; background: string; label: string }> = {
  OPERATIONAL: { color: "#25733b", background: "#e8f4e9", label: "运行正常" },
  OUTAGE: { color: "#b63e3a", background: "#fbeceb", label: "暂时离线" },
  PARTIAL_OUTAGE: { color: "#9a6512", background: "#fff5df", label: "部分可用" },
  MAINTENANCE: { color: "#9a6512", background: "#fff5df", label: "计划维护" },
  UNKNOWN: { color: "#9a6512", background: "#fff5df", label: "状态未知" },
};

export async function GET() {
  const data = await getDashboardData();
  const current = appearance[data.overall] ?? appearance.UNKNOWN;
  const title = `服务器整体状态：${current.label}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="28" viewBox="0 0 76 28" role="img" aria-labelledby="status-title"><title id="status-title">${title}</title><rect x="0.5" y="0.5" width="75" height="27" rx="13.5" fill="${current.background}" stroke="${current.color}"/><text x="38" y="14" fill="${current.color}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="12.8" font-weight="700" text-anchor="middle" dominant-baseline="middle">${current.label}</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=30, stale-while-revalidate=60", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
}

export function OPTIONS() { return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400" } }); }
