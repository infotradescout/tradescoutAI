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

    expect(source).toContain('"homeowner"');
    expect(source).toContain('"vehicle_owner"');
    expect(source).toContain('"service_provider"');
    expect(source).toContain('"seller"');
    expect(source).toContain('"realtor"');
    expect(source).toContain('"business_owner"');
    expect(source).toContain('"community_member"');
    expect(source).toContain('"browse_only"');
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
    expect(source).toContain('lane: "service_provider"');
    expect(source).toContain('claimType: "provides_services"');
    expect(source).toContain('legacySource: "contractor_signup"');
  });
});
