import type { Metadata } from "next";
import { StatusDatabase } from "@minecraft-status/database";
import { getDashboardData } from "../lib";
import { AutoRefresh, CopyAddress } from "../components/client";
import { TrendChart } from "../components/trend-chart";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Minecraft 服务器状态", description: "查看 Minecraft Java 与基岩版服务器状态、在线人数和延迟趋势。", openGraph: { title: "Minecraft 服务器状态", description: "实时服务器状态和在线人数趋势" } };

const labels: Record<string, string> = { OPERATIONAL: "运行正常", OUTAGE: "暂时离线", PARTIAL_OUTAGE: "部分可用", MAINTENANCE: "计划维护", UNKNOWN: "状态未知" };

export default async function Page() {
  const data = await getDashboardData();
  const database = new StatusDatabase();
  const trend = database.getHistory(24, 360);
  database.close();
  if (data.configurationError || !data.config) return <main className="shell"><p className="eyebrow">CONFIGURATION REQUIRED</p><h1>状态页尚未配置</h1><p>请复制 <code>config/server.example.yaml</code> 为 <code>config/server.yaml</code>，并填入受信任的服务器地址。</p></main>;
  const javaStatus = data.java?.status ?? "UNKNOWN";
  const bedrockStatus = data.bedrock?.status ?? "UNKNOWN";
  return <main className="shell">
    <AutoRefresh />
    <header><div><p className="eyebrow">MINECRAFT STATUS</p><h1>{data.config.server.name}</h1></div><div className={`status-pill ${data.overall.toLowerCase()}`}><span aria-hidden="true">●</span>{labels[data.overall]}</div></header>
    <section className="hero" aria-live="polite"><p>当前服务状态</p><h2>{data.overall === "OPERATIONAL" ? "所有入口均可正常加入" : labels[data.overall]}</h2><small>{data.checkedAt ? `最近检测：${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium", timeZone: data.config.server.timezone }).format(new Date(data.checkedAt))}` : "正在等待首次检测"}</small></section>
    <section className="cards" aria-label="连接入口">
      {data.config.java?.enabled && <article className="card"><div className="card-heading"><div><p className="eyebrow">JAVA EDITION</p><h2>Java 版</h2></div><span className={`endpoint ${javaStatus.toLowerCase()}`}>{labels[javaStatus]}</span></div><div className="address"><code>{data.config.java.displayAddress}</code><CopyAddress address={data.config.java.displayAddress} /></div>{data.java?.java ? <><div className="metrics"><div><b>{data.java.java.playersOnline}</b><span>/ {data.java.java.playersMax} 玩家</span></div><div><b>{data.java.java.latencyMs} ms</b><span>检测延迟</span></div><div><b>{data.java.java.versionName}</b><span>游戏版本</span></div></div><p className="motd">{data.java.java.motd || "服务器未提供 MOTD"}</p></> : <p className="muted">Java 版的实时信息将在首次成功检测后显示。</p>}</article>}
      {data.config.bedrock?.enabled && <article className="card"><div className="card-heading"><div><p className="eyebrow">BEDROCK EDITION</p><h2>基岩版</h2></div><span className={`endpoint ${bedrockStatus.toLowerCase()}`}>{labels[bedrockStatus]}</span></div><div className="address"><code>{data.config.bedrock.displayAddress}</code><CopyAddress address={data.config.bedrock.displayAddress} /></div><p className="muted">基岩版入口仅检测是否可以连接。在线人数、版本和延迟以 Java 版状态协议为准。</p></article>}
    </section>
    <section className="card chart-card"><div className="card-heading"><div><p className="eyebrow">JAVA PLAYER TREND</p><h2>在线人数趋势</h2></div><span className="muted">最近 24 小时</span></div><TrendChart points={trend} /><p className="muted">数据由 Java 版状态协议每分钟采集。检测中断显示为空白，不会被视为零人。</p></section>
    <section className="notice"><h2>状态说明</h2><p>状态由独立监控节点定期检测，反映该节点到服务器入口的连通性。Java 与基岩版通过同一服务器的兼容插件提供服务。</p>{data.config.maintenance.enabled && <p><strong>维护公告：</strong>{data.config.maintenance.message ?? "当前处于维护窗口。"}</p>}</section>
    <footer>自动刷新：前台每 60 秒一次；页面隐藏时降低刷新频率。</footer>
  </main>;
}
