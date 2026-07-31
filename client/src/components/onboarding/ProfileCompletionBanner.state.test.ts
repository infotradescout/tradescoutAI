import { describe, expect, it } from "vitest";
import { resolveProfileCompletionBannerMode } from "./ProfileCompletionBanner";

const readyPerson = {
  firstName: "Taylor",
  lastName: "Morgan",
  stateCode: "FL",
  countyFips: "12033",
  onboardingCompleted: true,
  profileVersion: 1,
  emailVerified: true,
  addressVerified: true,
  userIntent: "person",
};

function mode(user: any, path = "/scout") {
  return resolveProfileCompletionBannerMode({
    isLoading: false,
    isAuthenticated: true,
    user,
    path,
    skippedIntentDismissed: false,
  });
}

describe("resolveProfileCompletionBannerMode", () => {
  it("uses local setup before any profile or Direct Connect prompt", () => {
    expect(mode({ firstName: "Taylor", lastName: "Morgan" })).toBe("local_setup");
  });

  it("uses profile basics when locality exists but identity basics are missing", () => {
    expect(
      mode({ stateCode: "FL", countyFips: "12033", onboardingCompleted: true, profileVersion: 1 })
    ).toBe("profile_basics");
  });

  it("uses intent confirmation before verification or readiness", () => {
    expect(mode({ ...readyPerson, onboardingCompleted: false, profileVersion: 0 })).toBe(
      "onboarding"
    );
  });

  it("routes business verification through the existing business setup path", () => {
    expect(
      mode({
        ...readyPerson,
        userIntent: "business",
        role: "business_owner",
        verifiedBadge: false,
        verificationStatus: "pending",
      })
    ).toBe("business_setup");
  });

  it("does not show the banner after a person profile is ready", () => {
    expect(mode(readyPerson)).toBeNull();
  });

  it.each(["/onboarding", "/onboarding/profile", "/onboarding/intent", "/profile-setup"])(
    "does not layer a legacy banner on the universal setup surface: %s",
    (path) => expect(mode({ firstName: "Taylor" }, path)).toBeNull()
  );
});
