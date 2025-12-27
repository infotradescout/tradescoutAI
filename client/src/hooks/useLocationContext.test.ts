import { describe, it, expect } from "vitest";
import { hasCountyContext, type LocationContext } from "./useLocationContext";

describe("hasCountyContext", () => {
  const base: LocationContext = {
    layer: "global",
    source: "session",
  };

  it("returns false when no state or county is present", () => {
    expect(hasCountyContext(undefined)).toBe(false);
    expect(hasCountyContext(null)).toBe(false);
    expect(hasCountyContext(base)).toBe(false);
  });

  it("returns false when only stateCode is present", () => {
    const ctx: LocationContext = { ...base, stateCode: "TX" };
    expect(hasCountyContext(ctx)).toBe(false);
  });

  it("returns true when both stateCode and countyFips are present", () => {
    const ctx: LocationContext = { ...base, stateCode: "TX", countyFips: "48453" };
    expect(hasCountyContext(ctx)).toBe(true);
  });
});
