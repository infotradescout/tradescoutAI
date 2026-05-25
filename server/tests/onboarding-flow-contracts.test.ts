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

  it("uses unified lane-first onboarding selection from the intent step", () => {
    const intentSource = read("client/src/pages/onboarding-intent.tsx");

    expect(intentSource).toContain('apiRequest("POST", "/api/onboarding/start"');
    expect(intentSource).toContain("What are you here to do?");
    expect(intentSource).toContain("Manage my home");
    expect(intentSource).toContain("Manage my vehicle");
    expect(intentSource).toContain("Find local help");
    expect(intentSource).toContain("Provide services");
    expect(intentSource).toContain("Sell or list something");
    expect(intentSource).toContain("Real estate / property work");
    expect(intentSource).toContain("Run a local business");
    expect(intentSource).toContain("Just browse for now");
    expect(intentSource).toContain("Lane selection records intent only");
    expect(intentSource).not.toContain("contractor");
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
    expect(appRoutesSource).toContain('<Route path="/onboarding">');
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
    expect(helperSource).toContain("export function getBusinessOnboardingRoute");
    expect(helperSource).toContain("export function getFirstIncompleteBusinessModule");
    // Default landings must be defined
    expect(helperSource).toContain("export const DEFAULT_LANDING");
    expect(helperSource).toContain("export const BUSINESS_LANDING");
    // Business landing must be offer-services (profile + verification)
    expect(helperSource).toContain('"/offer-services"');
    expect(helperSource).toContain('"/address-verification"');
    expect(helperSource).toContain('"/license-verification"');
    expect(helperSource).toContain('"/insurance-verification"');
    // Personal default must be direct-connect
    expect(helperSource).toContain('"/direct-connect"');
  });

  it("enforces business onboarding module routing in shared auth guards", () => {
    const appRoutesSource = read("client/src/AppRoutes.tsx");
    const protectedRouteSource = read("client/src/components/ProtectedRoute.tsx");
    const helperSource = read("client/src/lib/postOnboardingRoute.ts");

    expect(appRoutesSource).toContain("getBusinessOnboardingRoute");
    expect(appRoutesSource).toContain("isBusinessOnboardingAllowedPath");
    expect(protectedRouteSource).toContain("getBusinessOnboardingRoute");
    expect(protectedRouteSource).toContain("isBusinessOnboardingAllowedPath");
    expect(helperSource).toContain("BUSINESS_MODULE_ALLOWED_PREFIXES");
    expect(helperSource).toContain("export function isBusinessOnboardingAllowedPath");
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

  it("maps legacy onboarding entry routes to unified onboarding lanes", () => {
    const appRoutesSource = read("client/src/AppRoutes.tsx");

    expect(appRoutesSource).toContain('<Route path="/businesses/apply">');
    expect(appRoutesSource).toContain('<RedirectTo to="/onboarding?lane=business_owner" />');
    expect(appRoutesSource).toContain('<Route path="/contractor-signup">');
    expect(appRoutesSource).toContain('<RedirectTo to="/onboarding?lane=service_provider" />');
    expect(appRoutesSource).toContain('<Route path="/provider-setup">');
  });
});
