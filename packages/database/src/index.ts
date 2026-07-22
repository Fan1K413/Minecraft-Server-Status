import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { calculateAvailability, decodeMotd, encodeMotd, motdText, type AvailabilityBucket, type DailyAvailability, type Edition, type EndpointSnapshot, type MotdPart, type TrendPoint } from "@minecraft-status/core";

export interface JavaDetails {
  playersOnline: number;
  playersMax: number;
  versionName: string;
  latencyMs: number;
  motd: string;
  motdParts: MotdPart[];
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

const baseSchema = `
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

const metadataSchema = `
CREATE TABLE IF NOT EXISTS favicon_blobs (
  hash TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  byte_length INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS endpoint_metadata_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition TEXT NOT NULL CHECK (edition IN ('JAVA', 'BEDROCK')),
  observed_at TEXT NOT NULL,
  version_name TEXT,
  motd TEXT,
  favicon_hash TEXT REFERENCES favicon_blobs(hash)
);
CREATE INDEX IF NOT EXISTS endpoint_metadata_events_edition_observed_at
  ON endpoint_metadata_events(edition, observed_at);
`;

type Metadata = { versionName: string | null; motd: string | null; faviconHash: string | null };

export class StatusDatabase {
  private readonly db: Database.Database;

  constructor(path = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/status.db") {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(baseSchema);
    const version = Number(this.db.pragma("user_version", { simple: true }));
    if (version > 1) throw new Error(`Database schema version ${version} is newer than this application supports.`);
    if (version < 1) this.db.transaction(() => {
      this.addColumnIfMissing("check_results", "metadata_event_id INTEGER REFERENCES endpoint_metadata_events(id)");
      this.addColumnIfMissing("endpoint_snapshots", "favicon_hash TEXT REFERENCES favicon_blobs(hash)");
      this.db.exec(metadataSchema);
      this.backfillMetadata();
      this.db.pragma("user_version = 1");
    })();
  }

  private addColumnIfMissing(table: string, definition: string): void {
    const column = definition.split(/\s+/, 1)[0];
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((entry) => entry.name === column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }

  private backfillMetadata(): void {
    const rows = this.db.prepare(`SELECT id, edition, checked_at, version_name, motd, favicon
      FROM check_results ORDER BY edition ASC, checked_at ASC, id ASC`).all() as Array<Record<string, unknown>>;
    const previous = new Map<string, Metadata>();
    const insertBlob = this.db.prepare("INSERT INTO favicon_blobs (hash, data, byte_length, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO NOTHING");
    const insertEvent = this.db.prepare(`INSERT INTO endpoint_metadata_events (edition, observed_at, version_name, motd, favicon_hash)
      VALUES (?, ?, ?, ?, ?)`);
    const linkRow = this.db.prepare("UPDATE check_results SET metadata_event_id = ? WHERE id = ?");

    for (const row of rows) {
      const hasMetadata = row.version_name !== null || row.motd !== null || row.favicon !== null;
      if (!hasMetadata) continue;
      const favicon = row.favicon === null ? null : String(row.favicon);
      const next: Metadata = {
        versionName: row.version_name === null ? previous.get(String(row.edition))?.versionName ?? null : String(row.version_name),
        motd: row.motd === null ? previous.get(String(row.edition))?.motd ?? null : String(row.motd),
        faviconHash: favicon === null ? previous.get(String(row.edition))?.faviconHash ?? null : faviconHash(favicon),
      };
      if (favicon !== null) insertBlob.run(next.faviconHash, favicon, Buffer.byteLength(favicon), String(row.checked_at));
      const old = previous.get(String(row.edition));
      if (!sameMetadata(old, next)) {
        const event = insertEvent.run(row.edition, row.checked_at, next.versionName, next.motd, next.faviconHash);
        linkRow.run(event.lastInsertRowid, row.id);
      }
      previous.set(String(row.edition), next);
    }

    const snapshots = this.db.prepare("SELECT edition, favicon FROM endpoint_snapshots WHERE favicon IS NOT NULL").all() as Array<{ edition: string; favicon: string }>;
    const updateSnapshot = this.db.prepare("UPDATE endpoint_snapshots SET favicon_hash = ? WHERE edition = ?");
    for (const snapshot of snapshots) {
      const hash = faviconHash(snapshot.favicon);
      insertBlob.run(hash, snapshot.favicon, Buffer.byteLength(snapshot.favicon), new Date().toISOString());
      updateSnapshot.run(hash, snapshot.edition);
    }
  }

  recordCheck(result: CheckResult, policy: { downAfterFailures: number; upAfterSuccesses: number }): void {
    const tx = this.db.transaction(() => {
      const existing = this.getSnapshot(result.edition);
      const existingMetadata = this.getSnapshotMetadata(result.edition);
      const successes = result.success ? (existing?.consecutiveSuccesses ?? 0) + 1 : 0;
      const failures = result.success ? 0 : (existing?.consecutiveFailures ?? 0) + 1;
      let status = existing?.status ?? "UNKNOWN";
      if (result.success && successes >= policy.upAfterSuccesses) status = "OPERATIONAL";
      if (!result.success && failures >= policy.downAfterFailures) status = "OUTAGE";

      const metadata = result.java ? {
        versionName: result.java.versionName,
        motd: encodeMotd(result.java.motdParts),
        faviconHash: result.java.favicon ? faviconHash(result.java.favicon) : null,
      } satisfies Metadata : null;
      let metadataEventId: number | null = null;
      if (metadata && !sameMetadata(existingMetadata, metadata)) {
        if (result.java?.favicon) this.db.prepare(`INSERT INTO favicon_blobs (hash, data, byte_length, created_at)
          VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO NOTHING`).run(metadata.faviconHash, result.java.favicon, Buffer.byteLength(result.java.favicon), result.checkedAt.toISOString());
        metadataEventId = Number(this.db.prepare(`INSERT INTO endpoint_metadata_events (edition, observed_at, version_name, motd, favicon_hash)
          VALUES (?, ?, ?, ?, ?)`).run(result.edition, result.checkedAt.toISOString(), metadata.versionName, metadata.motd, metadata.faviconHash).lastInsertRowid);
      }

      this.db.prepare(`INSERT INTO check_results (edition, checked_at, success, error_code, players_online, players_max, latency_ms, metadata_event_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(result.edition, result.checkedAt.toISOString(), Number(result.success), result.errorCode ?? null,
          result.java?.playersOnline ?? null, result.java?.playersMax ?? null, result.java?.latencyMs ?? null, metadataEventId);

      this.db.prepare(`INSERT INTO endpoint_snapshots (edition, status, consecutive_successes, consecutive_failures, checked_at, last_success_at, error_code, players_online, players_max, version_name, latency_ms, motd, favicon, favicon_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(edition) DO UPDATE SET status=excluded.status, consecutive_successes=excluded.consecutive_successes,
          consecutive_failures=excluded.consecutive_failures, checked_at=excluded.checked_at,
          last_success_at=excluded.last_success_at, error_code=excluded.error_code, players_online=excluded.players_online,
          players_max=excluded.players_max, version_name=excluded.version_name, latency_ms=excluded.latency_ms,
          motd=excluded.motd, favicon=excluded.favicon, favicon_hash=excluded.favicon_hash`)
        .run(result.edition, status, successes, failures, result.checkedAt.toISOString(),
          result.success ? result.checkedAt.toISOString() : existing?.lastSuccessAt?.toISOString() ?? null,
          result.errorCode ?? null, result.java?.playersOnline ?? existing?.java?.playersOnline ?? null,
          result.java?.playersMax ?? existing?.java?.playersMax ?? null, result.java?.versionName ?? existing?.java?.versionName ?? null,
          result.java?.latencyMs ?? existing?.java?.latencyMs ?? null,
          metadata?.motd ?? existingMetadata?.motd ?? null,
          result.java?.favicon ?? existing?.java?.favicon ?? null,
          metadata?.faviconHash ?? existingMetadata?.faviconHash ?? null);
    });
    tx();
  }

  private getSnapshotMetadata(edition: Edition): Metadata | null {
    const row = this.db.prepare("SELECT version_name, motd, favicon_hash FROM endpoint_snapshots WHERE edition = ?").get(edition) as Record<string, unknown> | undefined;
    return row ? { versionName: nullableString(row.version_name), motd: nullableString(row.motd), faviconHash: nullableString(row.favicon_hash) } : null;
  }

  getSnapshot(edition: Edition): PublicSnapshot | null {
    const row = this.db.prepare("SELECT * FROM endpoint_snapshots WHERE edition = ?").get(edition) as Record<string, unknown> | undefined;
    return row ? mapSnapshot(row) : null;
  }

  getHistory(rangeHours: number, maxPoints: number, now = new Date()): TrendPoint[] {
    const since = new Date(now.getTime() - rangeHours * 3_600_000).toISOString();
    const rows = this.db.prepare(`SELECT checked_at, players_online, latency_ms FROM check_results
      WHERE edition = 'JAVA' AND checked_at >= ? ORDER BY checked_at ASC`).all(since) as Record<string, unknown>[];
    const stride = Math.max(1, Math.ceil(rows.length / maxPoints));
    const selected = rows.filter((_, index) => index % stride === 0);
    if (rows.length && selected.at(-1) !== rows.at(-1)) selected.push(rows.at(-1)!);
    return selected.map((row) => ({
      at: String(row.checked_at), playersOnline: numberOrNull(row.players_online), latencyMs: numberOrNull(row.latency_ms),
    }));
  }

  getDailyAvailability(edition: Edition, days = 30, now = new Date()): DailyAvailability[] {
    const windowDays = Math.max(1, Math.min(days, 90));
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - windowDays + 1));
    const rows = this.db.prepare(`SELECT substr(checked_at, 1, 10) AS date,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures
      FROM check_results WHERE edition = ? AND checked_at >= ? GROUP BY substr(checked_at, 1, 10)`).all(edition, start.toISOString()) as Record<string, unknown>[];
    const byDate = new Map(rows.map((row) => [String(row.date), { successes: Number(row.successes), failures: Number(row.failures) }]));
    return Array.from({ length: windowDays }, (_, index) => {
      const day = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
      const counts = byDate.get(day) ?? { successes: 0, failures: 0 };
      return { date: day, ...counts, samples: counts.successes + counts.failures, percentage: calculateAvailability(counts.successes, counts.failures) };
    });
  }

  getAvailabilityBuckets(edition: Edition, rangeHours: number, bucketCount = 30, now = new Date()): AvailabilityBucket[] {
    const end = now.getTime(); const start = end - rangeHours * 3_600_000; const bucketMs = (end - start) / bucketCount;
    const buckets = Array.from({ length: bucketCount }, (_, index) => ({ startAt: new Date(start + index * bucketMs).toISOString(), endAt: new Date(start + (index + 1) * bucketMs).toISOString(), successes: 0, failures: 0, samples: 0, percentage: null as number | null }));
    const rows = this.db.prepare("SELECT checked_at, success FROM check_results WHERE edition = ? AND checked_at >= ? AND checked_at < ? ORDER BY checked_at").all(edition, new Date(start).toISOString(), new Date(end).toISOString()) as Record<string, unknown>[];
    for (const row of rows) { const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((new Date(String(row.checked_at)).getTime() - start) / bucketMs))); const bucket = buckets[index]; if (Number(row.success)) bucket.successes += 1; else bucket.failures += 1; bucket.samples += 1; }
    return buckets.map((bucket) => ({ ...bucket, percentage: calculateAvailability(bucket.successes, bucket.failures) }));
  }

  prune(retentionDays: number): number {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    return this.db.transaction(() => {
      const changes = this.db.prepare("DELETE FROM check_results WHERE checked_at < ?").run(cutoff).changes;
      this.db.exec(`DELETE FROM favicon_blobs
        WHERE NOT EXISTS (SELECT 1 FROM endpoint_metadata_events WHERE endpoint_metadata_events.favicon_hash = favicon_blobs.hash)
          AND NOT EXISTS (SELECT 1 FROM endpoint_snapshots WHERE endpoint_snapshots.favicon_hash = favicon_blobs.hash)`);
      return changes;
    })();
  }

  getSchemaVersion(): number { return Number(this.db.pragma("user_version", { simple: true })); }
  isReady(): boolean { return this.db.prepare("SELECT 1").get() !== undefined; }
  close(): void { this.db.close(); }
}

function faviconHash(favicon: string): string { return createHash("sha256").update(favicon, "utf8").digest("hex"); }
function sameMetadata(left: Metadata | undefined | null, right: Metadata): boolean {
  return left?.versionName === right.versionName && left?.motd === right.motd && left?.faviconHash === right.faviconHash;
}
function nullableString(value: unknown): string | null { return value === null || value === undefined ? null : String(value); }
function numberOrNull(value: unknown): number | null { return typeof value === "number" ? value : null; }
function mapSnapshot(row: Record<string, unknown>): PublicSnapshot {
  const motdParts = decodeMotd(row.motd ? String(row.motd) : null);
  const java = row.edition === "JAVA" && row.players_online !== null ? {
    playersOnline: Number(row.players_online), playersMax: Number(row.players_max), versionName: String(row.version_name ?? "未知"),
    latencyMs: Number(row.latency_ms), motd: motdText(motdParts), motdParts, favicon: row.favicon ? String(row.favicon) : null,
  } : null;
  return {
    edition: row.edition as Edition, status: row.status as EndpointSnapshot["status"],
    consecutiveSuccesses: Number(row.consecutive_successes), consecutiveFailures: Number(row.consecutive_failures),
    checkedAt: row.checked_at ? new Date(String(row.checked_at)) : null, lastSuccessAt: row.last_success_at ? new Date(String(row.last_success_at)) : null,
    errorCode: row.error_code ? String(row.error_code) : null, java,
  };
}
