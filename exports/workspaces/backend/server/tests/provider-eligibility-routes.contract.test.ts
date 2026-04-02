import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("provider eligibility route contracts", () => {
  it("authenticated provider eligibility read route returns explicit and computed envelopes", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain('"/api/providers/eligibility"');
    expect(routesSource).toContain(
      "const explicitEligibilities = await storage.getProviderEligibilitiesForUser(userId);"
    );
    expect(routesSource).toContain(
      "const computedEligibilities = await getComputedProviderEligibilitiesForUser(userId);"
    );
    expect(routesSource).toContain("explicitEligibilities,");
    expect(routesSource).toContain("computedEligibilities,");
    expect(routesSource).toContain(
      'res.status(500).json({ message: "Failed to fetch provider eligibility" });'
    );
  });

  it("admin provider eligibility write route validates jurisdiction before persisting", () => {
    const routesSource = read("server/routes.ts");

    expect(routesSource).toContain('"/api/admin/providers/:userId/eligibilities"');
    expect(routesSource).toContain(
      'return res.status(400).json({ message: "Invalid jurisdictionType" });'
    );
    expect(routesSource).toContain(
      'return res.status(400).json({ message: "Invalid eligibilityBasis" });'
    );
    expect(routesSource).toContain(
      'json({ message: "Valid stateCode is required for state eligibility" });'
    );
    expect(routesSource).toContain(
      'json({ message: "Valid countyFips is required for county eligibility" });'
    );
    expect(routesSource).toContain(
      "return res.status(400).json({ message: `Unknown countyFips: ${countyFips}` });"
    );
    expect(routesSource).toContain(
      'return res.status(400).json({ message: "Invalid expiresAt" });'
    );
    expect(routesSource).toContain(
      "const countyRecord = await storage.getCountyByFips(countyFips);"
    );
    expect(routesSource).toContain(
      "const explicitEligibilities = await storage.replaceProviderEligibilitiesForUser("
    );
    expect(routesSource).toContain("res.json({ explicitEligibilities, computedEligibilities });");
  });

  it("storage contract exposes provider eligibility read and replace methods", () => {
    const storageSource = read("server/storage.ts");

    expect(storageSource).toContain(
      "getProviderEligibilitiesForUser(userId: string): Promise<ProviderEligibility[]>"
    );
    expect(storageSource).toContain("replaceProviderEligibilitiesForUser(");
    expect(storageSource).toContain(
      "async getProviderEligibilitiesForUser(userId: string): Promise<ProviderEligibility[]>"
    );
    expect(storageSource).toContain("async replaceProviderEligibilitiesForUser(");
  });
});
