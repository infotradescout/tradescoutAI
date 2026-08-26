import { afterEach, describe, expect, it } from "vitest";
import {
  __resetAnalyticsForTests,
  getAnalytics,
  recordFallback,
  recordQuery,
} from "../services/adminAnalytics";

afterEach(() => {
  __resetAnalyticsForTests();
});

describe("admin analytics fallback counters", () => {
  it("tracks total fallback count", () => {
    recordFallback();
    recordFallback("schema_violation");
    const analytics = getAnalytics() as any;
    expect(analytics.fallbacks).toBe(2);
  });

  it("tracks fallback reasons independently", () => {
    recordFallback("synthesis_rate_limited");
    recordFallback("synthesis_rate_limited");
    recordFallback("json_parse_error");

    const analytics = getAnalytics() as any;
    expect(analytics.fallbackReasons.synthesis_rate_limited).toBe(2);
    expect(analytics.fallbackReasons.json_parse_error).toBe(1);
  });

  it("keeps query counters intact alongside fallback metrics", () => {
    recordQuery();
    recordFallback("intro_error");
    const analytics = getAnalytics() as any;
    expect(analytics.queries).toBe(1);
    expect(analytics.fallbacks).toBe(1);
    expect(analytics.lastQuery).toBeTruthy();
  });

  it("discloses that counters are process-local and non-durable", () => {
    const analytics = getAnalytics() as any;
    expect(analytics.scope).toBe("process_local");
    expect(analytics.durable).toBe(false);
  });

});
