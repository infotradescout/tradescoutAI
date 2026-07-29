import { describe, expect, it } from "vitest";
import {
  getOnboardingEntryRoute,
  getPostLandingRoute,
  userHasProfileBasics,
  userNeedsOnboarding,
} from "./lib/postOnboardingRoute";

describe("AppRoutes onboarding decisions", () => {
  it("routes authenticated users with stale onboarding state back to onboarding", () => {
    const user = {
      onboardingCompleted: false,
      profileVersion: 0,
      role: "homeowner",
    };

    expect(userNeedsOnboarding(user)).toBe(true);
    expect(getPostLandingRoute(user)).toBe("/onboarding/profile");
  });

  it("routes incomplete users with profile basics to the start-choice step", () => {
    const user = {
      firstName: "Taylor",
      lastName: "Reed",
      phone: "(555) 222-3333",
      stateCode: "FL",
      countyFips: "12033",
      locationCommitted: true,
      onboardingCompleted: false,
      profileVersion: 0,
      role: "homeowner",
    };

    expect(userNeedsOnboarding(user)).toBe(true);
    expect(userHasProfileBasics(user)).toBe(true);
    expect(getOnboardingEntryRoute(user)).toBe("/onboarding/intent");
    expect(getPostLandingRoute(user)).toBe("/onboarding/intent");
  });

  it("keeps users without account identity in profile setup", () => {
    const user = {
      firstName: "",
      lastName: "Reed",
      stateCode: "FL",
      countyFips: "12033",
      onboardingCompleted: false,
      profileVersion: 0,
      role: "homeowner",
    };

    expect(userHasProfileBasics(user)).toBe(false);
    expect(getOnboardingEntryRoute(user)).toBe("/onboarding/profile");
  });

  it("keeps users without phone in profile setup", () => {
    const user = {
      firstName: "Taylor",
      lastName: "Reed",
      phone: "",
      stateCode: "FL",
      countyFips: "12033",
      locationCommitted: true,
      onboardingCompleted: false,
      profileVersion: 0,
      role: "homeowner",
    };

    expect(userHasProfileBasics(user)).toBe(false);
    expect(getOnboardingEntryRoute(user)).toBe("/onboarding/profile");
  });

  it("accepts full name when split first/last fields are not present", () => {
    const user = {
      name: "Taylor Reed",
      phone: "(555) 222-3333",
      stateCode: "FL",
      countyFips: "12033",
      locationCommitted: true,
      onboardingCompleted: false,
      profileVersion: 0,
      role: "homeowner",
    };

    expect(userHasProfileBasics(user)).toBe(true);
    expect(getOnboardingEntryRoute(user)).toBe("/onboarding/intent");
  });

  it("routes fully onboarded admins to admin", () => {
    const user = {
      onboardingCompleted: true,
      profileVersion: 999,
      role: "super_admin",
      isSuperAdmin: true,
    };

    expect(userNeedsOnboarding(user)).toBe(false);
    expect(getPostLandingRoute(user)).toBe("/admin");
  });

  it("routes fully onboarded regular users to Direct Connect", () => {
    const user = {
      onboardingCompleted: true,
      profileVersion: 999,
      role: "homeowner",
    };

    expect(userNeedsOnboarding(user)).toBe(false);
    expect(getPostLandingRoute(user)).toBe("/direct-connect?entry=auth");
  });
});
