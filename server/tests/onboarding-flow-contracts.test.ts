import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("onboarding flow contracts", () => {
  it("routes profile normalization into intent confirmation before exiting setup", () => {
    const profileSource = read("client/src/pages/onboarding-profile.tsx");

    expect(profileSource).toContain(
      "return `/onboarding/intent?next=${encodeURIComponent(next)}`;"
    );
    expect(profileSource).toContain("navigate(buildIntentRoute(postProfileNext));");
    expect(profileSource).toContain(
      "if ((anyUser.onboardingCompleted as boolean | undefined) === true)"
    );
  });

  it("marks onboarding complete from the intent step", () => {
    const intentSource = read("client/src/pages/onboarding-intent.tsx");

    expect(intentSource).toContain('apiRequest("POST", "/api/user/complete-onboarding", {})');
    expect(intentSource).toContain("onSuccess: (_data, intent) => {");
    expect(intentSource).toContain("navigate(postIntentNext || routeForIntent(intent));");
  });

  it("enforces onboarding on authenticated routing until both completion + profile version are satisfied", () => {
    const appRoutesSource = read("client/src/AppRoutes.tsx");
    const protectedRouteSource = read("client/src/components/ProtectedRoute.tsx");
    const preScoutSource = read("client/src/pages/pre-scout-setup.tsx");

    expect(appRoutesSource).toContain("function userNeedsOnboarding(user: unknown): boolean");
    expect(appRoutesSource).toContain(
      "return !onboardingCompleted || profileVersion < CURRENT_PROFILE_VERSION;"
    );
    expect(appRoutesSource).toContain(
      'if (userNeedsOnboarding(user)) return "/onboarding/profile";'
    );
    expect(appRoutesSource).toContain("<AuthenticatedOnboardingGate />");

    expect(protectedRouteSource).toContain(
      "const needsOnboarding = profileVersion < CURRENT_PROFILE_VERSION || !onboardingCompleted;"
    );
    expect(protectedRouteSource).toContain("setLocation(`/onboarding/profile?next=${next}`);");

    expect(preScoutSource).toContain(
      "if (currentProfileVersion < CURRENT_PROFILE_VERSION || !onboardingCompleted)"
    );
  });

  it("keeps OAuth callback redirects onboarding-aware", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain(
      "profileVersion < CURRENT_PROFILE_VERSION || anyUser.onboardingCompleted !== true"
    );
  });
});
