export * from "./motd";

export type Edition = "JAVA" | "BEDROCK";
export type EndpointStatus = "OPERATIONAL" | "OUTAGE" | "UNKNOWN";
export type OverallStatus = EndpointStatus | "PARTIAL_OUTAGE" | "MAINTENANCE";

export interface MonitorPolicy {
  downAfterFailures: number;
  upAfterSuccesses: number;
  staleAfterIntervals: number;
  intervalSeconds: number;
}

export interface EndpointSnapshot {
  edition: Edition;
  status: EndpointStatus;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  checkedAt: Date | null;
  lastSuccessAt: Date | null;
}

export interface ProbeInput {
  success: boolean;
  checkedAt: Date;
}

export function isStale(snapshot: EndpointSnapshot, now: Date, policy: MonitorPolicy): boolean {
  if (!snapshot.checkedAt) return true;
  return now.getTime() - snapshot.checkedAt.getTime() > policy.intervalSeconds * policy.staleAfterIntervals * 1_000;
}

export function transitionSnapshot(
  previous: EndpointSnapshot,
  probe: ProbeInput,
  policy: MonitorPolicy,
): EndpointSnapshot {
  const consecutiveSuccesses = probe.success ? previous.consecutiveSuccesses + 1 : 0;
  const consecutiveFailures = probe.success ? 0 : previous.consecutiveFailures + 1;
  let status = previous.status;

  if (probe.success && consecutiveSuccesses >= policy.upAfterSuccesses) status = "OPERATIONAL";
  if (!probe.success && consecutiveFailures >= policy.downAfterFailures) status = "OUTAGE";

  return {
    ...previous,
    status,
    consecutiveSuccesses,
    consecutiveFailures,
    checkedAt: probe.checkedAt,
    lastSuccessAt: probe.success ? probe.checkedAt : previous.lastSuccessAt,
  };
}

export function publicEndpointStatus(snapshot: EndpointSnapshot | null, now: Date, policy: MonitorPolicy): EndpointStatus {
  if (!snapshot || isStale(snapshot, now, policy)) return "UNKNOWN";
  return snapshot.status;
}

export function overallStatus(
  javaStatus: EndpointStatus | null,
  bedrockStatus: EndpointStatus | null,
  maintenance: boolean,
): OverallStatus {
  if (maintenance) return "MAINTENANCE";
  const statuses = [javaStatus, bedrockStatus].filter((status): status is EndpointStatus => status !== null);
  if (!statuses.length || statuses.includes("UNKNOWN")) return "UNKNOWN";
  if (statuses.every((status) => status === "OPERATIONAL")) return "OPERATIONAL";
  if (statuses.every((status) => status === "OUTAGE")) return "OUTAGE";
  return "PARTIAL_OUTAGE";
}

export interface TrendPoint {
  at: string;
  playersOnline: number | null;
  latencyMs: number | null;
}

export function downsampleTrend(points: TrendPoint[], maxPoints: number): TrendPoint[] {
  if (points.length <= maxPoints) return points;
  const bucketSize = Math.ceil(points.length / maxPoints);
  const result: TrendPoint[] = [];
  for (let index = 0; index < points.length; index += bucketSize) {
    const bucket = points.slice(index, index + bucketSize);
    const players = bucket.map((point) => point.playersOnline).filter((value): value is number => value !== null);
    const latency = bucket.map((point) => point.latencyMs).filter((value): value is number => value !== null);
    result.push({
      at: bucket[0].at,
      playersOnline: players.length ? Math.round(players.reduce((sum, value) => sum + value, 0) / players.length) : null,
      latencyMs: latency.length ? Math.round(latency.reduce((sum, value) => sum + value, 0) / latency.length) : null,
    });
  }
  return result;
}

export type HistoryRange = "24h" | "3d" | "7d" | "15d" | "30d" | "all";
export const historyRangeHours: Record<Exclude<HistoryRange, "all">, number> = { "24h": 24, "3d": 72, "7d": 168, "15d": 360, "30d": 720 };
export function parseHistoryRange(value: string | null): HistoryRange { return value && value in historyRangeHours || value === "all" ? value as HistoryRange : "7d"; }

export interface AvailabilityBucket {
  startAt: string;
  endAt: string;
  successes: number;
  failures: number;
  samples: number;
  percentage: number | null;
}

export interface DailyAvailability {
  date: string;
  successes: number;
  failures: number;
  samples: number;
  percentage: number | null;
}

export function calculateAvailability(successes: number, failures: number): number | null {
  const total = successes + failures;
  return total ? (successes / total) * 100 : null;
}
