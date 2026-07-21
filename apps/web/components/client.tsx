"use client";

import { useEffect, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

export function CopyAddress({ address }: { address: string }) {
  const [state, setState] = useState<CopyState>("idle");
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2_000);
  }
  const label = state === "copied" ? "已复制" : state === "failed" ? "复制失败" : "复制地址";
  return <button className="copy-button" type="button" onClick={() => void copy()} aria-label={`复制地址 ${address}`} aria-live="polite">{label}</button>;
}

export function AutoRefresh() {
  useEffect(() => {
    let timer: number;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { window.location.reload(); }, document.hidden ? 300_000 : 60_000);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", schedule); };
  }, []);
  return null;
}
