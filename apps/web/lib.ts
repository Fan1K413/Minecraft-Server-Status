import { loadServerConfig, type ServerConfig } from "@minecraft-status/config";
import { overallStatus, publicEndpointStatus, type OverallStatus } from "@minecraft-status/core";
import { StatusDatabase, type PublicSnapshot } from "@minecraft-status/database";

export interface DashboardData {
  config: ServerConfig | null;
  java: PublicSnapshot | null;
  bedrock: PublicSnapshot | null;
  overall: OverallStatus;
  checkedAt: string | null;
  configurationError: string | null;
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const config = await loadServerConfig();
    const database = new StatusDatabase();
    const java = config.java?.enabled ? database.getSnapshot("JAVA") : null;
    const bedrock = config.bedrock?.enabled ? database.getSnapshot("BEDROCK") : null;
    const now = new Date();
    const javaStatus = config.java?.enabled ? publicEndpointStatus(java, now, config.monitor) : null;
    const bedrockStatus = config.bedrock?.enabled ? publicEndpointStatus(bedrock, now, config.monitor) : null;
    const maintenance = config.maintenance.enabled && (!config.maintenance.startsAt || new Date(config.maintenance.startsAt) <= now) && (!config.maintenance.endsAt || new Date(config.maintenance.endsAt) >= now);
    const checkedAt = [java?.checkedAt, bedrock?.checkedAt].filter((date): date is Date => Boolean(date)).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null;
    database.close();
    return { config, java, bedrock, overall: overallStatus(javaStatus, bedrockStatus, maintenance), checkedAt, configurationError: null };
  } catch (error) {
    return { config: null, java: null, bedrock: null, overall: "UNKNOWN", checkedAt: null, configurationError: error instanceof Error ? error.message : "无法加载服务器配置" };
  }
}
