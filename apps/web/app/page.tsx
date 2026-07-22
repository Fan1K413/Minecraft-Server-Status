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
    <footer className="project-links" aria-label="项目链接">
      <a href="https://github.com/Fan1K413/Minecraft-Server-Status" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2C6.477 2 2 6.486 2 12.02c0 4.426 2.865 8.18 6.839 9.504.5.093.682-.217.682-.484 0-.237-.009-.866-.014-1.7-2.782.605-3.369-1.343-3.369-1.343-.455-1.16-1.11-1.469-1.11-1.469-.908-.62.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.533 2.341 1.09 2.91.833.091-.647.349-1.09.635-1.34-2.22-.253-4.555-1.113-4.555-4.953 0-1.094.39-1.989 1.03-2.69-.103-.254-.447-1.275.098-2.658 0 0 .84-.27 2.75 1.028A9.563 9.563 0 0 1 12 6.5c.85.004 1.705.115 2.504.337 1.91-1.298 2.748-1.028 2.748-1.028.546 1.383.202 2.404.1 2.658.64.701 1.028 1.596 1.028 2.69 0 3.85-2.339 4.697-4.566 4.946.359.31.678.92.678 1.853 0 1.338-.012 2.418-.012 2.747 0 .27.18.582.688.483A10.02 10.02 0 0 0 22 12.02C22 6.486 17.523 2 12 2Z" /></svg>
        <span className="sr-only">GitHub 仓库</span>
      </a>
      <a href="https://fan1k413.github.io/Minecraft-Server-Status/" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4.5 3.5A2.5 2.5 0 0 0 2 6v12a2.5 2.5 0 0 0 2.5 2.5H10v-15H4.5A.5.5 0 0 0 4 6v12a.5.5 0 0 0 .5.5H8v-11H5.5V6.5H8V5.5H4.5Zm9.5 2V20.5h5.5A2.5 2.5 0 0 0 22 18V6a2.5 2.5 0 0 0-2.5-2.5H14Zm1 2h3.5v11H15v-11Zm-4 13h2v-15h-2v15Z" /></svg>
        <span className="sr-only">项目文档</span>
      </a>
    </footer>
  </main>;
}
