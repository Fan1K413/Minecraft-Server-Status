import type { TrendPoint } from "@minecraft-status/core";

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const values = points.map((point) => point.playersOnline).filter((value): value is number => value !== null);
  if (!values.length) return <p className="empty-chart">尚未采集到 Java 版在线人数数据。</p>;
  const maximum = Math.max(...values, 1);
  const path = points.map((point, index) => {
    if (point.playersOnline === null) return "";
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
    const y = 100 - (point.playersOnline / maximum) * 88 - 6;
    return `${index === 0 || points[index - 1]?.playersOnline === null ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return <div className="chart-wrap" role="img" aria-label={`过去 24 小时 Java 版在线人数趋势，最高 ${maximum} 人`}><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={path} /></svg><div className="chart-caption"><span>24 小时前</span><strong>最高 {maximum} 人</strong><span>现在</span></div></div>;
}
