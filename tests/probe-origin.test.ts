import { describe, expect, it } from "vitest";
import { isAllowedProbeOrigin } from "../apps/web/probe-origin";

describe("probe origin policy", () => {
  const production = { NODE_ENV: "production", APP_BASE_URL: "https://status.windking.fans" };
  it("accepts the configured public origin", () => { expect(isAllowedProbeOrigin("https://status.windking.fans", production)).toBe(true); });
  it("rejects a different origin and missing production config", () => { expect(isAllowedProbeOrigin("https://evil.example", production)).toBe(false); expect(isAllowedProbeOrigin("http://localhost:3000", { NODE_ENV: "production" })).toBe(false); });
  it("allows localhost only during development fallback", () => { expect(isAllowedProbeOrigin("http://localhost:3000", { NODE_ENV: "development" })).toBe(true); });
});
