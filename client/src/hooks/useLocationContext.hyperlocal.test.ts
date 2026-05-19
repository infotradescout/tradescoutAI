import { describe, expect, it } from "vitest";
import { hasLocalContext } from "./useLocationContext";

describe("hasLocalContext", () => {
  it("returns true for canonical county context", () => {
    expect(hasLocalContext({ stateCode: "FL", countyFips: "12033" } as any)).toBe(true);
  });

  it("returns true for coordinate-based local context", () => {
    expect(hasLocalContext({ lat: 30.4213, lng: -87.2169 } as any)).toBe(true);
  });

  it("returns true for explicit local label", () => {
    expect(hasLocalContext({ label: "East Hill, Pensacola" } as any)).toBe(true);
  });

  it("returns false when no local context exists", () => {
    expect(hasLocalContext({} as any)).toBe(false);
  });
});
