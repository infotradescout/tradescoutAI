import { beforeAll, describe, expect, it, vi } from "vitest";

let userNeedsOnboarding: typeof import("./AppRoutes").userNeedsOnboarding;
let getPostLandingRoute: typeof import("./AppRoutes").getPostLandingRoute;

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
