import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { StatusDatabase, type CheckResult } from "../packages/database/src/index";

const require = createRequire(new URL("../packages/database/package.json", import.meta.url));
const Database = require("better-sqlite3") as typeof import("better-sqlite3").default;

const directories: string[] = [];
const policy = { downAfterFailures: 3, upAfterSuccesses: 2 };

function databasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "minecraft-status-db-"));
  directories.push(directory);
  return join(directory, "status.db");
}

function javaCheck(at: string, overrides: Partial<CheckResult["java"]> = {}): CheckResult {
  return {
    edition: "JAVA", checkedAt: new Date(at), success: true,
    java: {
      playersOnline: 4, playersMax: 20, versionName: "1.21.5", latencyMs: 25,
      motd: "Welcome", motdParts: [{ text: "Welcome" }], favicon: "data:image/png;base64,AAAA",
      ...overrides,
    },
  };
}

afterEach(() => {
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

describe("StatusDatabase metadata storage", () => {
  it("keeps raw checks while recording metadata only when it changes", () => {
    const path = databasePath();
    const database = new StatusDatabase(path);
    database.recordCheck(javaCheck("2026-07-22T00:00:00.000Z"), policy);
    database.recordCheck(javaCheck("2026-07-22T00:01:00.000Z", { playersOnline: 6, latencyMs: 31 }), policy);
    database.recordCheck(javaCheck("2026-07-22T00:02:00.000Z", { versionName: "1.21.6" }), policy);
    database.recordCheck(javaCheck("2026-07-22T00:03:00.000Z", { motd: "Updated", motdParts: [{ text: "Updated" }] }), policy);
    database.recordCheck(javaCheck("2026-07-22T00:04:00.000Z", { favicon: "data:image/png;base64,BBBB" }), policy);
    database.recordCheck(javaCheck("2026-07-22T00:05:00.000Z"), policy);

    const raw = new Database(path, { readonly: true });
    expect(raw.prepare("SELECT COUNT(*) AS count FROM check_results").get()).toEqual({ count: 6 });
    expect(raw.prepare("SELECT COUNT(*) AS count FROM endpoint_metadata_events").get()).toEqual({ count: 5 });
    expect(raw.prepare("SELECT COUNT(*) AS count FROM favicon_blobs").get()).toEqual({ count: 2 });
    expect(raw.prepare("SELECT version_name, motd, favicon, metadata_event_id FROM check_results WHERE id = 2").get()).toEqual({ version_name: null, motd: null, favicon: null, metadata_event_id: null });
    expect(raw.prepare("SELECT players_online, latency_ms FROM check_results WHERE id = 2").get()).toEqual({ players_online: 6, latency_ms: 31 });
    raw.close();
    database.close();
  });

  it("retains current metadata after a failed check", () => {
    const database = new StatusDatabase(databasePath());
    database.recordCheck(javaCheck("2026-07-22T00:00:00.000Z"), policy);
    database.recordCheck({ edition: "JAVA", checkedAt: new Date("2026-07-22T00:01:00.000Z"), success: false, errorCode: "TIMEOUT" }, policy);

    const snapshot = database.getSnapshot("JAVA");
    expect(snapshot?.java).toMatchObject({ versionName: "1.21.5", motd: "Welcome", favicon: "data:image/png;base64,AAAA" });
    database.close();
  });

  it("migrates legacy rows without losing their raw data", () => {
    const path = databasePath();
    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE endpoint_snapshots (
        edition TEXT PRIMARY KEY, status TEXT NOT NULL, consecutive_successes INTEGER NOT NULL DEFAULT 0,
        consecutive_failures INTEGER NOT NULL DEFAULT 0, checked_at TEXT, last_success_at TEXT, error_code TEXT,
        players_online INTEGER, players_max INTEGER, version_name TEXT, latency_ms INTEGER, motd TEXT, favicon TEXT
      );
      CREATE TABLE check_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT, edition TEXT NOT NULL, checked_at TEXT NOT NULL, success INTEGER NOT NULL,
        error_code TEXT, players_online INTEGER, players_max INTEGER, version_name TEXT, latency_ms INTEGER, motd TEXT, favicon TEXT
      );
      INSERT INTO check_results (edition, checked_at, success, players_online, players_max, version_name, latency_ms, motd, favicon)
        VALUES ('JAVA', '2026-07-20T00:00:00.000Z', 1, 2, 20, '1.21.5', 10, '[{"text":"Hello"}]', 'data:image/png;base64,AAAA');
      INSERT INTO check_results (edition, checked_at, success, error_code) VALUES ('JAVA', '2026-07-20T00:01:00.000Z', 0, 'TIMEOUT');
    `);
    legacy.close();

    const database = new StatusDatabase(path);
    const migrated = new Database(path, { readonly: true });
    expect(database.getSchemaVersion()).toBe(1);
    expect(migrated.prepare("SELECT COUNT(*) AS count FROM check_results").get()).toEqual({ count: 2 });
    expect(migrated.prepare("SELECT COUNT(*) AS count FROM endpoint_metadata_events").get()).toEqual({ count: 1 });
    expect(migrated.prepare("SELECT COUNT(*) AS count FROM favicon_blobs").get()).toEqual({ count: 1 });
    expect(migrated.prepare("SELECT players_online, version_name FROM check_results WHERE id = 1").get()).toEqual({ players_online: 2, version_name: "1.21.5" });
    migrated.close();
    database.close();
  });
});
