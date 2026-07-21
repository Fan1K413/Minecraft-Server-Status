"use client";

import { useEffect, useState } from "react";

export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }
  return <button className="copy-button" type="button" onClick={() => void copy()} aria-label={`复制地址 ${address}`}>{copied ? "已复制" : "复制地址"}</button>;
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
