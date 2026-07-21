import Database from "better-sqlite3";
import type { Edition, EndpointSnapshot, TrendPoint } from "@minecraft-status/core";

export interface JavaDetails {
  playersOnline: number;
  playersMax: number;
  versionName: string;
  latencyMs: number;
  motd: string;
  favicon: string | null;
}

export interface CheckResult {
  edition: Edition;
  checkedAt: Date;
  success: boolean;
  errorCode?: string | null;
  java?: JavaDetails;
}

export interface PublicSnapshot extends EndpointSnapshot {
  errorCode: string | null;
  java: JavaDetails | null;
}

const schema = `
CREATE TABLE IF NOT EXISTS endpoint_snapshots (
  edition TEXT PRIMARY KEY CHECK (edition IN ('JAVA', 'BEDROCK')),
  status TEXT NOT NULL,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  last_success_at TEXT,
  error_code TEXT,
  players_online INTEGER,
  players_max INTEGER,
  version_name TEXT,
  latency_ms INTEGER,
  motd TEXT,
  favicon TEXT
);
CREATE TABLE IF NOT EXISTS check_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition TEXT NOT NULL CHECK (edition IN ('JAVA', 'BEDROCK')),
  checked_at TEXT NOT NULL,
  success INTEGER NOT NULL,
  error_code TEXT,
  players_online INTEGER,
  players_max INTEGER,
  version_name TEXT,
  latency_ms INTEGER,
  motd TEXT,
  favicon TEXT
);
CREATE INDEX IF NOT EXISTS check_results_edition_checked_at ON check_results(edition, checked_at);
`;

export class StatusDatabase {
  private readonly db: Database.Database;

  constructor(path = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/status.db") {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(schema);
  }

  recordCheck(result: CheckResult, policy: { downAfterFailures: number; upAfterSuccesses: number }): void {
    const tx = this.db.transaction(() => {
      const existing = this.getSnapshot(result.edition);
      const successes = result.success ? (existing?.consecutiveSuccesses ?? 0) + 1 : 0;
      const failures = result.success ? 0 : (existing?.consecutiveFailures ?? 0) + 1;
      let status = existing?.status ?? "UNKNOWN";
      if (result.success && successes >= policy.upAfterSuccesses) status = "OPERATIONAL";
      if (!result.success && failures >= policy.downAfterFailures) status = "OUTAGE";

      this.db.prepare(`INSERT INTO check_results (edition, checked_at, success, error_code, players_online, players_max, version_name, latency_ms, motd, favicon)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(result.edition, result.checkedAt.toISOString(), Number(result.success), result.errorCode ?? null,
          result.java?.playersOnline ?? null, result.java?.playersMax ?? null, result.java?.versionName ?? null,
          result.java?.latencyMs ?? null, result.java?.motd ?? null, result.java?.favicon ?? null);

      this.db.prepare(`INSERT INTO endpoint_snapshots (edition, status, consecutive_successes, consecutive_failures, checked_at, last_success_at, error_code, players_online, players_max, version_name, latency_ms, motd, favicon)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(edition) DO UPDATE SET status=excluded.status, consecutive_successes=excluded.consecutive_successes,
          consecutive_failures=excluded.consecutive_failures, checked_at=excluded.checked_at,
          last_success_at=excluded.last_success_at, error_code=excluded.error_code, players_online=excluded.players_online,
          players_max=excluded.players_max, version_name=excluded.version_name, latency_ms=excluded.latency_ms,
          motd=excluded.motd, favicon=excluded.favicon`)
        .run(result.edition, status, successes, failures, result.checkedAt.toISOString(),
          result.success ? result.checkedAt.toISOString() : existing?.lastSuccessAt?.toISOString() ?? null,
          result.errorCode ?? null, result.java?.playersOnline ?? existing?.java?.playersOnline ?? null,
          result.java?.playersMax ?? existing?.java?.playersMax ?? null, result.java?.versionName ?? existing?.java?.versionName ?? null,
          result.java?.latencyMs ?? existing?.java?.latencyMs ?? null, result.java?.motd ?? existing?.java?.motd ?? null,
          result.java?.favicon ?? existing?.java?.favicon ?? null);
    });
    tx();
  }

  getSnapshot(edition: Edition): PublicSnapshot | null {
    const row = this.db.prepare("SELECT * FROM endpoint_snapshots WHERE edition = ?").get(edition) as Record<string, unknown> | undefined;
    return row ? mapSnapshot(row) : null;
  }

  getHistory(rangeHours: number, maxPoints: number): TrendPoint[] {
    const since = new Date(Date.now() - rangeHours * 3_600_000).toISOString();
    const rows = this.db.prepare(`SELECT checked_at, players_online, latency_ms FROM check_results
      WHERE edition = 'JAVA' AND checked_at >= ? ORDER BY checked_at ASC`).all(since) as Record<string, unknown>[];
    const stride = Math.max(1, Math.ceil(rows.length / maxPoints));
    return rows.filter((_, index) => index % stride === 0).map((row) => ({
      at: String(row.checked_at), playersOnline: numberOrNull(row.players_online), latencyMs: numberOrNull(row.latency_ms),
    }));
  }

  prune(retentionDays: number): number {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    return this.db.prepare("DELETE FROM check_results WHERE checked_at < ?").run(cutoff).changes;
  }

  isReady(): boolean { return this.db.prepare("SELECT 1").get() !== undefined; }
  close(): void { this.db.close(); }
}

function numberOrNull(value: unknown): number | null { return typeof value === "number" ? value : null; }
function mapSnapshot(row: Record<string, unknown>): PublicSnapshot {
  const java = row.edition === "JAVA" && row.players_online !== null ? {
    playersOnline: Number(row.players_online), playersMax: Number(row.players_max), versionName: String(row.version_name ?? "未知"),
    latencyMs: Number(row.latency_ms), motd: String(row.motd ?? ""), favicon: row.favicon ? String(row.favicon) : null,
  } : null;
  return {
    edition: row.edition as Edition, status: row.status as EndpointSnapshot["status"],
    consecutiveSuccesses: Number(row.consecutive_successes), consecutiveFailures: Number(row.consecutive_failures),
    checkedAt: row.checked_at ? new Date(String(row.checked_at)) : null, lastSuccessAt: row.last_success_at ? new Date(String(row.last_success_at)) : null,
    errorCode: row.error_code ? String(row.error_code) : null, java,
  };
}
