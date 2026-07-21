import { describe, expect, it } from "vitest";
import { calculateAvailability } from "../packages/core/src/index";

describe("availability calculation", () => {
  it("returns null without recorded checks", () => { expect(calculateAvailability(0, 0)).toBeNull(); });
  it("calculates success ratios", () => { expect(calculateAvailability(30, 0)).toBe(100); expect(calculateAvailability(0, 30)).toBe(0); expect(calculateAvailability(29, 1)).toBeCloseTo(96.6667); });
});
