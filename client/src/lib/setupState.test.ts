import { describe, expect, it } from "vitest";
import { hasCompletedSetup } from "./setupState";

describe("hasCompletedSetup", () => {
  it("treats onboardingCompleted as complete", () => {
    expect(hasCompletedSetup({ onboardingCompleted: true, profileVersion: 0 })).toBe(true);
  });

  it("does not infer completion from profile version", () => {
    expect(hasCompletedSetup({ onboardingCompleted: false, profileVersion: 1 })).toBe(false);
  });

  it("does not infer completion from canonical county setup", () => {
    expect(
      hasCompletedSetup({
        onboardingCompleted: false,
        profileVersion: 0,
        stateCode: "AL",
        countyFips: "01097",
      })
    ).toBe(false);
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
