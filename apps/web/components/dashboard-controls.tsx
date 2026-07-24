"use client";

import { useEffect, useRef, useState } from "react";
import type { AvailabilityBucket, HistoryRange, TrendPoint } from "@minecraft-status/core";
import { AvailabilityBars } from "./availability-bars";
import { TrendChart } from "./trend-chart";

const ranges: { value: HistoryRange; label: string }[] = [{ value: "24h", label: "24小时" }, { value: "3d", label: "3天" }, { value: "7d", label: "7天" }, { value: "15d", label: "15天" }, { value: "30d", label: "30天" }, { value: "all", label: "全部" }];
type AvailabilityResponse = { availability: { java: AvailabilityBucket[]; bedrock: AvailabilityBucket[] } };

export function AvailabilityControl({ edition, initial }: { edition: "JAVA" | "BEDROCK"; initial: AvailabilityBucket[] }) {
  const [range, setRange] = useState<HistoryRange>("3d"); const [records, setRecords] = useState(initial); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const menu = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  async function select(next: HistoryRange): Promise<void> { setOpen(false); if (next === range) return; setLoading(true); setError(""); try { const response = await fetch(`/api/v1/history?range=${next}`); if (!response.ok) throw new Error(); const data = await response.json() as AvailabilityResponse; setRecords(edition === "JAVA" ? data.availability.java : data.availability.bedrock); setRange(next); } catch { setError("无法更新可用性记录"); } finally { setLoading(false); } }
  const label = ranges.find((item) => item.value === range)?.label ?? "7天";
  return <div className="availability-control"><AvailabilityBars records={records} control={<div className="availability-control-heading" ref={menu}><button type="button" className="availability-range" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} disabled={loading}>{loading ? "加载中…" : `${label}可用率`}</button>{open && <div className="range-menu" role="menu">{ranges.map((item) => <button key={item.value} type="button" role="menuitem" onClick={() => void select(item.value)}>{item.label}</button>)}</div>}</div>} />{error && <span className="history-error" role="status">{error}</span>}</div>;
}

export function PlayerTrendPanel({ initial, initialFrom, initialTo }: { initial: TrendPoint[]; initialFrom: string; initialTo: string }) {
  const [range, setRange] = useState<HistoryRange>("3d"); const [points, setPoints] = useState(initial); const [window, setWindow] = useState({ from: initialFrom, to: initialTo }); const [loading, setLoading] = useState(false);
  async function change(next: HistoryRange): Promise<void> { if (next === range) return; setLoading(true); try { const response = await fetch(`/api/v1/history?range=${next}`); if (!response.ok) throw new Error(); const data = await response.json() as { history: TrendPoint[]; from: string; to: string }; setPoints(data.history); setWindow({ from: data.from, to: data.to }); setRange(next); } finally { setLoading(false); } }
  const label = ranges.find((item) => item.value === range)?.label ?? "7天";
  return <section className="section" aria-labelledby="trend-heading"><div className="section-heading"><div><p className="eyebrow">PLAYER TREND</p><h2 id="trend-heading">在线人数趋势</h2></div><div className="range-selector">{ranges.map((item) => <button key={item.value} type="button" className={item.value === range ? "range-active" : ""} onClick={() => void change(item.value)} disabled={loading}>{item.label}</button>)}</div></div><article className="chart-card"><TrendChart points={points} label={label} from={window.from} to={window.to} /></article></section>;
}

export function ProbeButton({ scope, label, className }: { scope: "JAVA" | "BEDROCK" | "all"; label: string; className: string }) {
  const [checking, setChecking] = useState(false); const [result, setResult] = useState("");
  async function probe(): Promise<void> { setChecking(true); try { const response = await fetch("/api/v1/probe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope }) }); const requestId = response.headers.get("x-request-id"); const contentType = response.headers.get("content-type") ?? ""; const data = contentType.includes("application/json") ? await response.json() as { results?: Record<string, { success: boolean; latencyMs?: number }>; success?: boolean; error?: string; code?: string } : null; if (!response.ok) { const messages: Record<number, string> = { 403: "浏览器来源未获授权", 413: "请求过大", 429: "检查过于频繁", 503: "检查服务不可用" }; setResult(`${messages[response.status] ?? "检查请求失败"}${requestId ? `（请求 ID: ${requestId}）` : ""}`); } else if (!data) { setResult("检查服务返回了无效响应"); } else { const results = data.results ?? (scope === "all" ? {} : { [scope]: data }); const passed = Object.values(results).filter((item) => item.success).length; setResult(scope === "all" ? `刚刚检查：${passed}/${Object.keys(results).length} 个入口可连接` : (data.success ? "刚刚检查：可连接" : "刚刚检查：无法连接")); } } catch { setResult("无法连接检查服务"); } finally { setChecking(false); } }
  return <div className="probe-status"><button className={`${scope === "all" ? "status-pill" : "endpoint"} endpoint-button ${className}`} type="button" onClick={() => void probe()} disabled={checking} aria-busy={checking}>{checking ? "正在检查…" : label}</button>{result && <span role="status">{result}</span>}</div>;
}
