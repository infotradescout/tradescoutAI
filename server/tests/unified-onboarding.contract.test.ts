import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("unified onboarding contracts", () => {
  it("exposes unified onboarding endpoints", () => {
    const source = read("server/routes/onboarding.ts");

    expect(source).toContain('router.post("/api/onboarding/start"');
    expect(source).toContain('router.post("/api/onboarding/claim"');
    expect(source).toContain('router.post("/api/onboarding/complete-step"');
    expect(source).toContain('router.get("/api/onboarding/status"');
  });

  it("supports required onboarding lanes", () => {
    const source = read("server/routes/onboarding.ts");

    expect(source).toContain('"find_help"');
    expect(source).toContain('"manage_projects"');
    expect(source).toContain('"offer_services"');
    expect(source).toContain('"sell_items"');
    expect(source).toContain('"real_estate"');
    expect(source).toContain('"business"');
    expect(source).toContain('"community"');
    expect(source).toContain('"browse_only"');
    expect(source).toContain('"home"');
    expect(source).toContain('"vehicle"');
    expect(source).toContain('"project"');
    expect(source).toContain('"business"');
    expect(source).toContain('"saved_search"');
  });

  it("emits generic onboarding events", () => {
    const source = read("server/services/onboardingService.ts");

    expect(source).toContain('"onboarding_started"');
    expect(source).toContain('"role_selected"');
    expect(source).toContain('"claim_submitted"');
    expect(source).toContain('"profile_started"');
    expect(source).toContain('"verification_started"');
    expect(source).toContain('"setup_step_completed"');
    expect(source).toContain('"onboarding_completed"');
  });

  it("keeps contractor signup as legacy wrapper to unified onboarding", () => {
    const source = read("server/routes/contractor-signup.ts");

    expect(source).toContain("startUnifiedOnboarding");
    expect(source).toContain("submitUnifiedOnboardingClaim");
    expect(source).toContain('lane: "offer_services"');
    expect(source).toContain('claimType: "offer_local_services"');
    expect(source).toContain('legacySource: "contractor_signup"');
  });

  it("maps legacy lane terms into unified intent + assets", () => {
    const source = read("server/services/onboardingService.ts");
    expect(source).toContain("homeowner");
    expect(source).toContain('lane: "manage_projects"');
    expect(source).toContain('asset: "home"');
    expect(source).toContain("vehicle_owner");
    expect(source).toContain('asset: "vehicle"');
  });
});
