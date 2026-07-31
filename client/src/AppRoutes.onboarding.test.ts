import { describe, expect, it } from "vitest";
import {
  getBusinessOnboardingRoute,
  getOnboardingEntryRoute,
  getPostLandingRoute,
  isBusinessOnboardingAllowedPath,
  userHasProfileBasics,
  userNeedsOnboarding,
} from "./lib/postOnboardingRoute";

describe("AppRoutes universal onboarding decisions", () => {
  it("uses one canonical onboarding route for every incomplete account", () => {
    const sparseUser = {
      onboardingCompleted: false,
      profileVersion: 0,
      role: "homeowner",
    };
    const businessUser = {
      onboardingCompleted: false,
      role: "business_owner",
      preferences: {
        provisional: { profileDraft: { presenceType: "represent_business" } },
      },
    };

    expect(getOnboardingEntryRoute(sparseUser)).toBe("/onboarding");
    expect(getOnboardingEntryRoute(businessUser)).toBe("/onboarding");
    expect(getPostLandingRoute(sparseUser)).toBe("/onboarding");
    expect(getPostLandingRoute(businessUser)).toBe("/onboarding");
  });

  it("does not gate onboarding on name, phone, county, or profile version", () => {
    const user = {
      onboardingCompleted: false,
      firstName: "",
      lastName: "",
      phone: "",
      stateCode: "",
      countyFips: "",
      profileVersion: 0,
    };

    expect(userHasProfileBasics(user)).toBe(true);
    expect(userNeedsOnboarding(user)).toBe(true);
    expect(getOnboardingEntryRoute(user)).toBe("/onboarding");
  });

  it("treats completion as the only onboarding state transition", () => {
    expect(userNeedsOnboarding({ onboardingCompleted: false, profileVersion: 999 })).toBe(true);
    expect(userNeedsOnboarding({ onboardingCompleted: true, profileVersion: 0 })).toBe(false);
  });

  it("does not force completed business users through verification or finance modules", () => {
    const businessUser = {
      onboardingCompleted: true,
      role: "business_owner",
      verificationStatus: "pending",
      preferences: {
        businessOnboarding: {
          modules: {
            trust_verification: "not_started",
            operations_payout: "not_started",
          },
        },
      },
    };

    expect(getBusinessOnboardingRoute(businessUser)).toBeNull();
    expect(isBusinessOnboardingAllowedPath("/scout", businessUser)).toBe(true);
    expect(getPostLandingRoute(businessUser)).toBe("/direct-connect?entry=auth");
  });

  it("keeps the admin landing after universal onboarding completes", () => {
    const admin = {
      onboardingCompleted: true,
      role: "super_admin",
      isSuperAdmin: true,
    };

    expect(getPostLandingRoute(admin)).toBe("/admin");
  });
});
