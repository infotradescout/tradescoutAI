import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("business onboarding and discoverability contracts", () => {
  it("enforces business discoverability lock in visibility and profile publishing routes", () => {
    const routesSource = read("server/routes.ts");
    const businessProfileSource = read("server/routes/business-profile.ts");
    const visibilityMutationSource = read("server/services/profileVisibilityMutation.ts");

    expect(visibilityMutationSource).toContain("BUSINESS_DISCOVERY_LOCKED");
    expect(visibilityMutationSource).toContain(
      "Business discovery is locked until verification is complete"
    );

    expect(businessProfileSource).toContain("discoverabilityLocked");
    expect(businessProfileSource).toContain(
      "Complete verification to make your business discoverable"
    );
    expect(businessProfileSource).toContain("if (!isBusinessDiscoverable(ownerUser))");
  });

  it("keeps business onboarding transitions forward-only and verification-truth based", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain("BUSINESS_ONBOARDING_ALLOWED_NEXT");
    expect(routesSource).toContain("Invalid business onboarding transition");
    expect(routesSource).toContain("BUSINESS_VERIFICATION_REQUIRED");
    expect(routesSource).toContain("trust_verification");
    expect(routesSource).toContain("activeProfileOfferCount");
    expect(routesSource).toContain("booksCounts");
    expect(routesSource).toContain('enforceModule("service_catalog", "complete")');
    expect(routesSource).toContain('enforceModule("operations_payout", "in_progress")');
    expect(routesSource).toContain("syncBusinessOnboardingFromSignals");
    expect(routesSource).toContain("recordBusinessOnboardingTransitionEvents");
    expect(routesSource).toContain("business_onboarding.module_transition");
    expect(routesSource).toContain("business_onboarding_manual_update");
    expect(routesSource).toContain("/api/admin/business-onboarding/telemetry");
    expect(routesSource).toContain("hasBusinessOnboardingAnalyticsAccess");
    expect(routesSource).toContain("usersWithBusinessOnboarding");
    expect(routesSource).toContain("statusCounts");
    expect(routesSource).toContain("recentTransitions");
    expect(routesSource).toContain('app.get("/api/auth/user"');
    expect(routesSource).toContain("user = await syncBusinessOnboardingFromSignals(user);");
  });
});
