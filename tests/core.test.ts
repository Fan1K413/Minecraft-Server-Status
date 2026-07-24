import { describe, expect, it } from "vitest";
import { calculateAvailability, downsampleTrend, overallStatus, transitionSnapshot } from "../packages/core/src/index";

describe("status rules", () => {
  const policy = { downAfterFailures: 3, upAfterSuccesses: 2, staleAfterIntervals: 3, intervalSeconds: 60 };
  const unknown = { edition: "JAVA" as const, status: "UNKNOWN" as const, consecutiveSuccesses: 0, consecutiveFailures: 0, checkedAt: null, lastSuccessAt: null };
  it("requires three failures before an outage", () => {
    const first = transitionSnapshot(unknown, { success: false, checkedAt: new Date() }, policy);
    const second = transitionSnapshot(first, { success: false, checkedAt: new Date() }, policy);
    const third = transitionSnapshot(second, { success: false, checkedAt: new Date() }, policy);
    expect(second.status).toBe("UNKNOWN"); expect(third.status).toBe("OUTAGE");
  });
  it("requires two successes to recover", () => {
    const outage = { ...unknown, status: "OUTAGE" as const };
    const first = transitionSnapshot(outage, { success: true, checkedAt: new Date() }, policy);
    expect(transitionSnapshot(first, { success: true, checkedAt: new Date() }, policy).status).toBe("OPERATIONAL");
  });
  it("derives partial and maintenance status", () => {
    expect(overallStatus("OPERATIONAL", "OUTAGE", false)).toBe("PARTIAL_OUTAGE");
    expect(overallStatus("OUTAGE", "OUTAGE", true)).toBe("MAINTENANCE");
  });
  it("keeps valid samples when a long null run exceeds the point budget", () => {
    const points = [{ at: "2026-07-23T00:00:00.000Z", playersOnline: 1, latencyMs: 10 }, ...Array.from({ length: 449 }, (_, index) => ({ at: new Date(Date.UTC(2026, 6, 23, 0, index + 1)).toISOString(), playersOnline: null, latencyMs: null })), { at: "2026-07-23T08:00:00.000Z", playersOnline: 0, latencyMs: 12 }, { at: "2026-07-23T08:01:00.000Z", playersOnline: null, latencyMs: null, gap: true }];
    const sampled = downsampleTrend(points, 360);
    expect(sampled.filter((point) => point.playersOnline !== null)).toHaveLength(2);
    expect(sampled.filter((point) => point.playersOnline === null)).toHaveLength(2);
    expect(sampled.at(-1)?.at).toBe("2026-07-23T08:01:00.000Z");
    expect(calculateAvailability(9, 1)).toBe(90);
  });
});
