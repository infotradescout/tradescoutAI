import { describe, expect, it } from "vitest";
import { getDiscoveryScopeRobotsDecision } from "./discoveryScopeIndexability";

describe("discovery scope hydration indexability", () => {
  it.each([
    { isLoading: true, hasError: false, itemCount: 0 },
    { isLoading: false, hasError: true, itemCount: 3 },
  ])("preserves the SSR robots directive while data is unresolved", (state) => {
    expect(getDiscoveryScopeRobotsDecision(state)).toEqual({
      noIndex: false,
      preserveRobots: true,
    });
  });

  it.each([0, Number.NaN])("sets noindex after an authoritative empty response", (itemCount) => {
    expect(
      getDiscoveryScopeRobotsDecision({ isLoading: false, hasError: false, itemCount })
    ).toEqual({ noIndex: true, preserveRobots: false });
  });

  it("permits indexing after substantive snapshot-backed data hydrates", () => {
    expect(
      getDiscoveryScopeRobotsDecision({ isLoading: false, hasError: false, itemCount: 1 })
    ).toEqual({ noIndex: false, preserveRobots: false });
  });
});
