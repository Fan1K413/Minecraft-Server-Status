import type { Metadata } from "next";
import { StatusDatabase } from "@minecraft-status/database";
import { getDashboardData } from "../lib";
import { AutoRefresh, CopyAddress } from "../components/client";
import { AvailabilityControl, PlayerTrendPanel, ProbeButton } from "../components/dashboard-controls";
import { Motd } from "../components/motd";
import "./globals.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minecraft 服务器状态", description: "查看 Minecraft 服务器状态、在线人数与连接入口。" };
const labels: Record<string, string> = { OPERATIONAL: "运行正常", OUTAGE: "暂时离线", PARTIAL_OUTAGE: "部分可用", MAINTENANCE: "计划维护", UNKNOWN: "状态未知" };

export default async function Page() {
  const data = await getDashboardData(); const database = new StatusDatabase(); const trend = database.getHistory(168, 420); const availability = { java: database.getAvailabilityBuckets("JAVA", 168), bedrock: database.getAvailabilityBuckets("BEDROCK", 168) }; database.close();
  if (data.configurationError || !data.config) return <main className="shell"><p className="eyebrow">CONFIGURATION REQUIRED</p><h1>状态页尚未配置</h1><p>请复制 <code>config/server.example.yaml</code> 为 <code>config/server.yaml</code>，并填入受信任的服务器地址。</p></main>;
  const javaStatus = data.java?.status ?? "UNKNOWN"; const bedrockStatus = data.bedrock?.status ?? "UNKNOWN"; const sharedDetails = data.java?.java ?? null; const enabledEndpoints = [data.config.java?.enabled, data.config.bedrock?.enabled].filter(Boolean).length;
  const checkedAt = data.checkedAt ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: data.config.server.timezone }).format(new Date(data.checkedAt)) : "等待首次检测";
  return <main className="shell"><AutoRefresh /><header className="site-header"><div><p className="eyebrow">MINECRAFT SERVER</p><h1>{data.config.server.name}</h1></div><div className="overall-status"><ProbeButton scope="all" label={labels[data.overall]} className={data.overall.toLowerCase()} /><time className="checked-time" dateTime={data.checkedAt ?? undefined}>{checkedAt}</time></div></header>
    <section className="section endpoints-section" aria-labelledby="endpoints-heading"><div className="section-heading"><div><p className="eyebrow">CONNECTIONS</p><h2 id="endpoints-heading">连接入口</h2></div></div><div className={`cards cards-${enabledEndpoints}`}>
      {data.config.java?.enabled && <article className="card"><div className="card-heading"><h3>Java 版</h3><ProbeButton scope="JAVA" label={labels[javaStatus]} className={javaStatus.toLowerCase()} /></div><div className="address"><code>{data.config.java.displayAddress}</code><CopyAddress address={data.config.java.displayAddress} /></div><AvailabilityControl edition="JAVA" initial={availability.java} /></article>}
      {data.config.bedrock?.enabled && <article className="card"><div className="card-heading"><h3>基岩版</h3><ProbeButton scope="BEDROCK" label={labels[bedrockStatus]} className={bedrockStatus.toLowerCase()} /></div><div className="address"><code>{data.config.bedrock.displayAddress}</code><CopyAddress address={data.config.bedrock.displayAddress} /></div><AvailabilityControl edition="BEDROCK" initial={availability.bedrock} /></article>}
    </div></section>
    <section className="section" aria-labelledby="details-heading"><div className="section-heading"><div><p className="eyebrow">SERVER DETAILS</p><h2 id="details-heading">服务器信息</h2></div><span className="source-note">实时状态</span></div>{sharedDetails ? <article className="details-panel"><div className="metrics"><div><span>当前在线</span><b>{sharedDetails.playersOnline} <small>/ {sharedDetails.playersMax}</small></b></div><div><span>游戏版本</span><b>{sharedDetails.versionName}</b></div><div><span>连接延迟</span><b>{sharedDetails.latencyMs} <small>ms</small></b></div></div><div className="motd"><span>MOTD</span><Motd parts={sharedDetails.motdParts} /></div></article> : <p className="empty-state">服务器实时信息将在首次成功检测后显示。</p>}</section>
    <PlayerTrendPanel initial={trend} />
  </main>;
}
