import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("business onboarding and discoverability contracts", () => {
  it("enforces business discoverability lock in visibility and profile publishing routes", () => {
    const routesSource = read("server/routes.ts");
    const businessProfileSource = read("server/routes/business-profile.ts");

    expect(routesSource).toContain("BUSINESS_DISCOVERY_LOCKED");
    expect(routesSource).toContain("Business discovery is locked until verification is complete");

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
  });
});
