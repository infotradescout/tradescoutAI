import { describe, expect, it } from "vitest";
import { isOnboardingSurfacePath } from "./onboardingSurface";

describe("isOnboardingSurfacePath", () => {
  it.each([
    "/onboarding",
    "/onboarding/",
    "/onboarding/profile",
    "/onboarding/intent?next=%2Fscout",
    "/profile-setup",
  ])("treats every universal onboarding URL as the same setup surface: %s", (path) => {
    expect(isOnboardingSurfacePath(path)).toBe(true);
  });

  it.each([
    "/scout",
    "/offer-services",
    "/profile/settings",
    "/u/onboarding",
    "/onboarding/unknown-legacy-step",
  ])("does not hide chrome on unrelated pages: %s", (path) =>
    expect(isOnboardingSurfacePath(path)).toBe(false)
  );
});
