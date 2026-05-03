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

    // buildIntentRoute now uses storeOnboardingNext + conditional query param
    expect(profileSource).toContain("buildIntentRoute");
    expect(profileSource).toContain("navigate(buildIntentRoute(postProfileNext));");
    expect(profileSource).toContain(
      "if ((anyUser.onboardingCompleted as boolean | undefined) === true)"
    );
    // Deep-link must be persisted into sessionStorage before the intent step
    expect(profileSource).toContain("storeOnboardingNext");
  });

  it("marks onboarding complete from the intent step", () => {
    const intentSource = read("client/src/pages/onboarding-intent.tsx");

    // Both the save-intent and skip paths must call complete-onboarding
    expect(intentSource).toContain('apiRequest("POST", "/api/user/complete-onboarding", {})');
    // onSuccess handler must navigate using the smart routing helper
    expect(intentSource).toContain("resolveDestination(intent)");
    expect(intentSource).toContain("resolveDestination(null)");
    // Skip path must also call complete-onboarding (not just navigate away)
    expect(intentSource).toContain("skipMutation");
    // Smart routing helper must be imported
    expect(intentSource).toContain("resolvePostOnboardingRoute");
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
      "if (userNeedsOnboarding(user)) return getOnboardingEntryRoute(user);"
    );
    expect(appRoutesSource).toContain('return userHasProfileBasics(user) ? "/onboarding/intent"');
    expect(appRoutesSource).toContain("<AuthenticatedOnboardingGate />");
    // Deep-link preservation must be wired into the gate
    expect(appRoutesSource).toContain("storeOnboardingNext");

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

  it("smart post-onboarding routing helper covers all exit paths", () => {
    const helperSource = read("client/src/lib/postOnboardingRoute.ts");

    // Must export the main resolver
    expect(helperSource).toContain("export function resolvePostOnboardingRoute");
    // Must detect business users
    expect(helperSource).toContain("export function isBusinessUser");
    // Must have session-storage helpers for deep-link preservation
    expect(helperSource).toContain("export function storeOnboardingNext");
    expect(helperSource).toContain("export function consumeOnboardingNext");
    // Default landings must be defined
    expect(helperSource).toContain("export const DEFAULT_LANDING");
    expect(helperSource).toContain("export const BUSINESS_LANDING");
    // Business landing must be offer-services (profile + verification)
    expect(helperSource).toContain('"/offer-services"');
    // Personal default must be direct-connect
    expect(helperSource).toContain('"/direct-connect"');
  });
});
