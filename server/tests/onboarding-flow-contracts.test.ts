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
    expect(profileSource).toContain("Setting up a business profile");
    expect(profileSource).toContain("fixed-price offers, verification, and bookkeeping review");
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
    expect(intentSource).toContain("Offer or Sell");
    expect(intentSource).toContain("profile, offers, verification, and books");
  });

  it("enforces onboarding on authenticated routing until both completion + profile version are satisfied", () => {
    const appRoutesSource = read("client/src/AppRoutes.tsx");
    const protectedRouteSource = read("client/src/components/ProtectedRoute.tsx");
    const preScoutSource = read("client/src/pages/pre-scout-setup.tsx");

    expect(appRoutesSource).toContain("userNeedsOnboarding as routeUserNeedsOnboarding");
    expect(appRoutesSource).toContain("getOnboardingEntryRoute as routeGetOnboardingEntryRoute");
    expect(appRoutesSource).toContain(
      "export const userNeedsOnboarding = routeUserNeedsOnboarding;"
    );
    expect(appRoutesSource).toContain(
      "export const getOnboardingEntryRoute = routeGetOnboardingEntryRoute;"
    );
    expect(appRoutesSource).toContain("if (!userNeedsOnboarding(user)) return;");
    expect(appRoutesSource).toContain("<AuthenticatedOnboardingGate />");
    // Deep-link preservation must be wired into the gate
    expect(appRoutesSource).toContain("storeOnboardingNext");

    expect(protectedRouteSource).toContain("const needsOnboarding = userNeedsOnboarding(user);");
    expect(protectedRouteSource).toContain(
      "setLocation(`${getOnboardingEntryRoute(user)}?next=${next}`);"
    );

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

  it("turns offer-services into a provider launch hub instead of only verification", () => {
    const offerServicesSource = read("client/src/pages/offer-services.tsx");

    expect(offerServicesSource).toContain("Profile launch setup");
    expect(offerServicesSource).toContain("Fixed-price services and items");
    expect(offerServicesSource).toContain('queryKey: ["/api/profile-offers/mine"]');
    expect(offerServicesSource).toContain(
      'queryKey: ["/api/profile-offer-purchases/mine", "seller"]'
    );
    expect(offerServicesSource).toContain('"/api/profile-offers"');
    expect(offerServicesSource).toContain("startEditingOffer");
    expect(offerServicesSource).toContain("Save offer");
    expect(offerServicesSource).toContain('queryKey: ["/api/profiles"]');
    expect(offerServicesSource).toContain('queryKey: ["/api/business-profile/me"]');
    expect(offerServicesSource).toContain('queryKey: ["/api/accounting/books-foundation"]');
    expect(offerServicesSource).toContain('document.getElementById("fixed-price-offers")');
    expect(offerServicesSource).toContain('method: "PATCH"');
    expect(offerServicesSource).toContain("Pause");
    expect(offerServicesSource).toContain("Resume");
    expect(offerServicesSource).toContain("serviceCategory");
    expect(offerServicesSource).toContain("serviceDurationMinutes");
    expect(offerServicesSource).toContain("itemStockQuantity");
    expect(offerServicesSource).toContain("itemFulfillmentMode");
    expect(offerServicesSource).toContain("shippingCost");
    expect(offerServicesSource).toContain("Profile purchase review");
    expect(offerServicesSource).toContain("Review books");
    expect(offerServicesSource).toContain("Service purchases create");
    expect(offerServicesSource).toContain("No payment, contact release, posting, or shipping");
    expect(offerServicesSource).not.toContain("premium Direct Connect job tiers");
    expect(offerServicesSource).not.toContain("rank higher in search results");
  });

  it("routes post-onboarding provider actions into offers and finance setup", () => {
    const actionSource = read("client/src/scout/resolvePostOnboardingActions.ts");

    expect(actionSource).toContain("Set up profile, offers & verification");
    expect(actionSource).toContain('destination: "/offer-services"');
    expect(actionSource).toContain("Add fixed-price services or items");
    expect(actionSource).toContain('destination: "/offer-services#fixed-price-offers"');
    expect(actionSource).toContain("Review finance records");
    expect(actionSource).toContain('destination: "/finances/records"');
  });
});
