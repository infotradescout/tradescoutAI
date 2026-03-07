import { describe, it, expect } from "vitest";
import {
  hasCountyContext,
  hasPendingCountyResolution,
  type LocationContext,
} from "./useLocationContext";

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

describe("hasPendingCountyResolution", () => {
  const base: LocationContext = {
    layer: "global",
    source: "session",
  };

  it("returns false without enough legacy location information", () => {
    expect(hasPendingCountyResolution(undefined)).toBe(false);
    expect(hasPendingCountyResolution(null)).toBe(false);
    expect(hasPendingCountyResolution(base)).toBe(false);
    expect(hasPendingCountyResolution({ ...base, stateCode: "TX" })).toBe(false);
  });

  it("returns true when state code and county name exist but countyFips is still missing", () => {
    const ctx: LocationContext = {
      ...base,
      layer: "county",
      source: "profile",
      stateCode: "TX",
      countyName: "Travis County",
    };

    expect(hasPendingCountyResolution(ctx)).toBe(true);
  });

  it("returns false once canonical countyFips is present", () => {
    const ctx: LocationContext = {
      ...base,
      layer: "county",
      source: "profile",
      stateCode: "TX",
      countyFips: "48453",
      countyName: "Travis County",
    };

    expect(hasPendingCountyResolution(ctx)).toBe(false);
  });
});
