import { describe, expect, it } from "vitest";
import { hasCompletedSetup } from "./setupState";

describe("hasCompletedSetup", () => {
  it("treats onboardingCompleted as complete", () => {
    expect(hasCompletedSetup({ onboardingCompleted: true, profileVersion: 0 })).toBe(true);
  });

  it("treats current profile version as complete", () => {
    expect(hasCompletedSetup({ onboardingCompleted: false, profileVersion: 1 })).toBe(true);
  });

  it("treats canonical county setup as complete for legacy users", () => {
    expect(
      hasCompletedSetup({
        onboardingCompleted: false,
        profileVersion: 0,
        stateCode: "AL",
        countyFips: "01097",
      })
    ).toBe(true);
  });

  it("returns false when no completion signals exist", () => {
    expect(
      hasCompletedSetup({
        onboardingCompleted: false,
        profileVersion: 0,
        stateCode: "",
        countyFips: "",
      })
    ).toBe(false);
  });

  it("does not treat locationCommitted alone as complete", () => {
    expect(
      hasCompletedSetup({
        onboardingCompleted: false,
        profileVersion: 0,
        locationCommitted: true,
        stateCode: "",
        countyFips: "",
      })
    ).toBe(false);
  });
});
