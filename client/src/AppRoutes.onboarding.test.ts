import { beforeAll, describe, expect, it, vi } from "vitest";

let userNeedsOnboarding: typeof import("./AppRoutes").userNeedsOnboarding;
let getPostLandingRoute: typeof import("./AppRoutes").getPostLandingRoute;
let getOnboardingEntryRoute: typeof import("./AppRoutes").getOnboardingEntryRoute;
let userHasProfileBasics: typeof import("./AppRoutes").userHasProfileBasics;

beforeAll(async () => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { pathname: "/", search: "", assign: vi.fn() },
    history: { replaceState: vi.fn() },
  });

  const mod = await import("./AppRoutes");
  userNeedsOnboarding = mod.userNeedsOnboarding;
  getPostLandingRoute = mod.getPostLandingRoute;
  getOnboardingEntryRoute = mod.getOnboardingEntryRoute;
  userHasProfileBasics = mod.userHasProfileBasics;
});

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
      stateCode: "FL",
      countyFips: "12033",
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
});
