"use client";

import { useMemo, useState } from "react";
import type { TrendPoint } from "@minecraft-status/core";

export function TrendChart({ points, label = "24小时" }: { points: TrendPoint[]; label?: string }) {
  const values = points.map((point) => point.playersOnline).filter((value): value is number => value !== null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeX, setActiveX] = useState<number | null>(null);
  const valid = useMemo(() => points.map((point, index) => point.playersOnline === null ? -1 : index).filter((index) => index >= 0), [points]);
  const maximum = Math.max(...values, 1);
  const startTime = new Date(points[0].at).getTime(); const endTime = new Date(points.at(-1)?.at ?? points[0].at).getTime();
  const coordinate = (index: number) => { const time = new Date(points[index].at).getTime(); const x = Number.isFinite(time) && endTime > startTime ? ((time - startTime) / (endTime - startTime)) * 100 : points.length === 1 ? 0 : (index / (points.length - 1)) * 100; return { x, y: 100 - ((points[index].playersOnline ?? 0) / maximum) * 88 - 6 }; };
  const path = (() => { const segments: string[] = []; let segment: string[] = []; points.forEach((point, index) => { if (point.playersOnline === null) { if (segment.length) segments.push(segment.join(" ")); segment = []; return; } const { x, y } = coordinate(index); segment.push(`${segment.length ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`); }); if (segment.length) segments.push(segment.join(" ")); return segments.join(" "); })();
  const active = activeIndex === null ? null : points[activeIndex];
  const activeDataPoint = active && active.playersOnline !== null ? coordinate(activeIndex!) : null;
  const tooltipX = activeX ?? activeDataPoint?.x ?? null;
  const activePoint = activeDataPoint && tooltipX !== null ? { x: tooltipX, y: activeDataPoint.y } : null;
  const formattedTime = (index: number) => new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(points[index].at)).replace(/\//g, "-");
  function nearest(event: React.PointerEvent<SVGSVGElement>): void { const rect = event.currentTarget.getBoundingClientRect(); const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); const x = ratio * 100; setActiveX(x); if (!valid.length) { setActiveIndex(null); return; } const index = valid.reduce((best, current) => Math.abs(coordinate(current).x - x) < Math.abs(coordinate(best).x - x) ? current : best, valid[0]); setActiveIndex(Math.abs(coordinate(index).x - x) <= 1.5 ? index : null); }
  function keyDown(event: React.KeyboardEvent<SVGSVGElement>): void { if (!valid.length) return; const current = activeIndex === null ? 0 : Math.max(0, valid.indexOf(activeIndex)); if (event.key === "Escape") { setActiveIndex(null); return; } if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? valid.length - 1 : Math.max(0, Math.min(valid.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1))); setActiveIndex(valid[next]); } }
  return <div className="chart-wrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`过去 ${label} 在线人数趋势，最高 ${maximum} 人`} tabIndex={0} onPointerMove={nearest} onPointerLeave={() => { setActiveIndex(null); setActiveX(null); }} onFocus={() => { setActiveIndex(valid.at(-1) ?? null); setActiveX(null); }} onKeyDown={keyDown}><path d={path} />{activePoint && <><line className="chart-guide" x1={activePoint.x} x2={activePoint.x} y1="0" y2="100" /><circle className="chart-dot" cx={activePoint.x} cy={activePoint.y} r="1.5" /></>}</svg>{active && active.playersOnline !== null && tooltipX !== null && activePoint && <div className="chart-tooltip" style={{ left: `${Math.max(8, Math.min(92, tooltipX))}%`, top: `${activePoint.y * 1.9 - 16}px` }}><strong>{formattedTime(activeIndex!)}</strong><span>在线人数 {active.playersOnline}</span></div>}<span className="sr-only" aria-live="polite">{active?.playersOnline !== null && active ? `${formattedTime(activeIndex!)}，在线人数 ${active.playersOnline}` : ""}</span><div className="chart-caption"><span>{label}前</span><strong>最高 {maximum} 人</strong><span>现在</span></div></div>;
}
