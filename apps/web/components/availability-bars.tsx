"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { calculateAvailability, type AvailabilityBucket } from "@minecraft-status/core";

function barClass(record: AvailabilityBucket): string {
  if (record.percentage === null) return "availability-unknown";
  if (record.percentage === 100) return "availability-up";
  if (record.percentage === 0) return "availability-down";
  return "availability-partial";
}

function statusLabel(record: AvailabilityBucket): string {
  if (record.percentage === null) return "暂无采样";
  if (record.percentage === 100) return "正常";
  if (record.percentage === 0) return "离线";
  return "部分可用";
}

export function AvailabilityBars({ records, control }: { records: AvailabilityBucket[]; control?: ReactNode }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const successes = records.reduce((total, record) => total + record.successes, 0);
  const failures = records.reduce((total, record) => total + record.failures, 0);
  const percentage = calculateAvailability(successes, failures);
  const formatter = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const active = activeIndex === null ? null : records[activeIndex] ?? null;
  const describe = (record: AvailabilityBucket) => {
    const range = `${formatter.format(new Date(record.startAt))} - ${formatter.format(new Date(record.endAt))}`;
    if (record.percentage === null) return `${range}，暂无采样`;
    return `${range}，${statusLabel(record)}，可用率 ${record.percentage.toFixed(2)}%，成功 ${record.successes} 次，失败 ${record.failures} 次，共 ${record.samples} 次检测`;
  };
  const clear = () => { if (pinnedIndex === null) setActiveIndex(null); };
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === "Escape") { setActiveIndex(null); setPinnedIndex(null); event.currentTarget.blur(); return; }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? records.length - 1 : Math.max(0, Math.min(records.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
    setActiveIndex(next);
    buttons.current[next]?.focus();
  }
  return <div className="availability"><div className="availability-heading">{control ?? <span>可用率</span>}<strong>{percentage === null ? "暂无数据" : `${percentage.toFixed(2)}%`}</strong></div><div className="availability-tooltip-wrap"><div className="availability-bars" aria-label={`可用率：${percentage === null ? "暂无采样" : `${percentage.toFixed(2)}%`}`} onPointerLeave={clear}>{records.map((record, index) => <button key={record.startAt} ref={(element) => { buttons.current[index] = element; }} type="button" className={`availability-bar ${barClass(record)}${activeIndex === index ? " availability-bar-active" : ""}`} aria-label={describe(record)} aria-pressed={pinnedIndex === index} onPointerEnter={() => { if (pinnedIndex === null) setActiveIndex(index); }} onFocus={() => { if (pinnedIndex === null) setActiveIndex(index); }} onBlur={clear} onClick={() => { const nextPinned = pinnedIndex === index ? null : index; setPinnedIndex(nextPinned); setActiveIndex(nextPinned === null ? null : index); }} onKeyDown={(event) => keyDown(event, index)} />)}</div>{active && <div className="availability-tooltip" role="status" style={{ left: `${Math.max(8, Math.min(92, ((activeIndex! + 0.5) / records.length) * 100))}%` }}><strong>{formatter.format(new Date(active.startAt))} - {formatter.format(new Date(active.endAt))}</strong><span>{statusLabel(active)}{active.percentage === null ? "" : ` · ${active.percentage.toFixed(2)}%`}</span>{active.percentage === null ? <span>此时段没有检测记录</span> : <span>成功 {active.successes} · 失败 {active.failures} · 共 {active.samples} 次检测</span>}</div>}</div><span className="sr-only" aria-live="polite">{active ? describe(active) : ""}</span><div className="availability-labels"><span>开始</span><span>现在</span></div></div>;
}
