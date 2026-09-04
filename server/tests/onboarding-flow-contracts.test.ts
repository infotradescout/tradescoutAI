import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("onboarding flow contracts", () => {
  it("uses one universal outcome owner at every onboarding compatibility URL", () => {
    const onboardingSource = read("client/src/pages/onboarding.tsx");
    const appRoutesSource = read("client/src/AppRoutes.tsx");

    expect(
      fs.existsSync(path.resolve(process.cwd(), "client/src/pages/onboarding-profile.tsx"))
    ).toBe(false);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "client/src/pages/onboarding-intent.tsx"))
    ).toBe(false);
    expect(appRoutesSource).toContain('<Route path="/onboarding/profile">');
    expect(appRoutesSource).toContain('<Route path="/onboarding/intent">');
    expect(appRoutesSource.match(/<LazyPage Component={Onboarding} \/>/g)).toHaveLength(4);
    expect(onboardingSource).toContain('apiRequest("/api/onboarding/complete", {');
    expect(onboardingSource).toContain('method: "POST"');
    expect(onboardingSource).toContain('data-testid="onboarding-goal"');
    expect(onboardingSource).toContain('data-testid="business-switch"');
    expect(onboardingSource).toContain("uploadObject(file)");
    expect(onboardingSource).toContain("consumeOnboardingNext");
    expect(onboardingSource).not.toContain("INTENT_OPTIONS");
    expect(onboardingSource).not.toContain("ASSET_OPTIONS");
  });

  it("enforces the one explicit completion state while preserving exact continuations", () => {
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
    expect(appRoutesSource).toContain("if (!userNeedsOnboarding(user)) {");
    expect(appRoutesSource).toContain("<AuthenticatedOnboardingGate />");
    expect(appRoutesSource).toContain('<Route path="/onboarding">');
    expect(appRoutesSource).toContain("storeOnboardingNext");

    expect(protectedRouteSource).toContain("const needsOnboarding = userNeedsOnboarding(user);");
    expect(protectedRouteSource).toContain("isSafeNextPath(requestedPath)");
    expect(preScoutSource).toContain("if (!onboardingCompleted)");
    expect(preScoutSource).not.toContain("currentProfileVersion < CURRENT_PROFILE_VERSION");
  });

  it("keeps OAuth callback redirects onboarding-aware", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain(
      "const needsProfileNormalization = !isOutcomeOnboardingComplete(anyUser);"
    );
    expect(routesSource).not.toContain(
      "profileVersion < CURRENT_PROFILE_VERSION || anyUser.onboardingCompleted !== true"
    );
  });

  it("keeps exact same-origin handoffs and removes business module forcing", () => {
    const helperSource = read("client/src/lib/postOnboardingRoute.ts");

    // Must export the main resolver
    expect(helperSource).toContain("export function resolvePostOnboardingRoute");
    expect(helperSource).toContain("export function isSafeNextPath");
    expect(helperSource).toContain("export function storeOnboardingNext");
    expect(helperSource).toContain("export function consumeOnboardingNext");
    expect(helperSource).toContain("export function getBusinessOnboardingRoute");
    expect(helperSource).toContain("export const DEFAULT_LANDING");
    expect(helperSource).toContain("return null;");
    expect(helperSource).not.toContain("BUSINESS_MODULE_ROUTE");
    expect(helperSource).not.toContain("getFirstIncompleteBusinessModule");
  });

  it("does not force completed businesses through verification or finance guards", () => {
    const appRoutesSource = read("client/src/AppRoutes.tsx");
    const protectedRouteSource = read("client/src/components/ProtectedRoute.tsx");
    const helperSource = read("client/src/lib/postOnboardingRoute.ts");

    expect(appRoutesSource).not.toContain("getBusinessOnboardingRoute");
    expect(appRoutesSource).not.toContain("isBusinessOnboardingAllowedPath");
    expect(protectedRouteSource).not.toContain("getBusinessOnboardingRoute");
    expect(protectedRouteSource).not.toContain("isBusinessOnboardingAllowedPath");
    expect(helperSource).toContain("export function isBusinessOnboardingAllowedPath");
    expect(helperSource).toContain("return true;");
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
    expect(offerServicesSource).not.toContain('queryKey: ["/api/business-profile/me"]');
    expect(offerServicesSource).toContain("const activeBusinessProfile =");
    expect(offerServicesSource).toContain(
      "`/u/${encodeURIComponent(activeBusinessProfile.slug)}/edit`"
    );
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

  it("maps legacy public business entry routes to the single claims-first path", () => {
    const appRoutesSource = read("client/src/AppRoutes.tsx");

    expect(appRoutesSource).toContain('<Route path="/businesses/apply">');
    expect(appRoutesSource).toContain(
      '<RedirectTo to="/claim-my-business?source=businesses_apply_legacy" />'
    );
    expect(appRoutesSource).toContain('<Route path="/contractor-signup">');
    expect(appRoutesSource).toContain(
      '<RedirectTo to="/claim-my-business?source=contractor_signup_legacy" />'
    );
    expect(appRoutesSource).toContain('<Route path="/provider-setup">');
    expect(appRoutesSource).toContain(
      '<RedirectTo to="/claim-my-business?source=provider_setup_legacy" />'
    );
  });
});
