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
  it("keeps missing player data as gaps while downsampling", () => {
    expect(downsampleTrend([{ at: "1", playersOnline: 3, latencyMs: 1 }, { at: "2", playersOnline: null, latencyMs: null }], 1)[0].playersOnline).toBe(3);
    expect(calculateAvailability(9, 1)).toBe(90);
  });
});
