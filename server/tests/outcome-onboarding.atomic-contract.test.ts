import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("outcome onboarding atomic persistence contract", () => {
  it("commits the business, linked profile, and user completion through one repository transaction", () => {
    const source = read("server/repositories/outcomeOnboardingRepository.ts");

    expect(source).toContain("db.transaction");
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("businessId: business.id");
    expect(source).toContain("activeBusinessId: business.id");
    expect(source).toContain("activeProfileId: profile.id");
    expect(source).toContain("onboardingCompleted: true");
    expect(source).toContain("profileVersion: CURRENT_PROFILE_VERSION");
  });

  it("locks and re-checks canonical identity across accounts before inserting", () => {
    const source = read("server/repositories/outcomeOnboardingRepository.ts");
    const identityLock = source.indexOf("outcome-business-name:");
    const canonicalRead = source.indexOf("const canonicalCandidates", identityLock);
    const insert = source.indexOf(".insert(businesses)");

    expect(identityLock).toBeGreaterThan(-1);
    expect(canonicalRead).toBeGreaterThan(identityLock);
    expect(insert).toBeGreaterThan(canonicalRead);
    expect(source).toContain("findDefensibleCanonicalBusinessMatches");
    expect(source).toContain("enforceCanonicalBusinessIdentityResolution(identityMatches");
    expect(source).toContain("outcome-business-domain:");
  });

  it("loads all owner profiles and resolves exact unlinked matches before creating a profile", () => {
    const source = read("server/repositories/outcomeOnboardingRepository.ts");
    const ownerProfileRead = source.indexOf("const ownerProfiles");
    const unlinkedResolution = source.indexOf("resolveUnlinkedBusinessProfileTarget(ownerProfiles");
    const profileInsert = source.indexOf(".insert(profiles)");

    expect(ownerProfileRead).toBeGreaterThan(-1);
    expect(unlinkedResolution).toBeGreaterThan(ownerProfileRead);
    expect(profileInsert).toBeGreaterThan(unlinkedResolution);
  });

  it("resolves owned targets explicitly and never selects the oldest business implicitly", () => {
    const repository = read("server/repositories/outcomeOnboardingRepository.ts");
    const service = read("server/services/onboardingService.ts");

    expect(repository).toContain("resolveOwnedBusinessOutcomeTarget(ownedBusinesses");
    expect(repository).not.toContain("firstOwned");
    expect(repository).not.toContain("orderBy(asc(businesses.createdAt))");
    expect(service).toContain("BusinessSelectionRequiredError");
    expect(service).toContain("targetBusinessId");
  });

  it("does not flip the user-wide profile visibility while completing one business", () => {
    const service = read("server/services/onboardingService.ts");
    const businessPreferences = service.slice(
      service.indexOf("export function buildOutcomePreferences"),
      service.indexOf("function sameJson")
    );

    expect(businessPreferences).not.toContain('profileVisibility: "public"');
  });

  it("does not import or invoke verification, trust, or claim persistence", () => {
    const repository = read("server/repositories/outcomeOnboardingRepository.ts");
    const service = read("server/services/onboardingService.ts");

    expect(repository).not.toMatch(
      /businessVerifications|trustSnapshots|verificationStatus|claimUnclaimedBusiness/
    );
    expect(service).not.toContain('"verification_started"');
    expect(service).not.toContain("claimUnclaimedBusinessForUser");
  });

  it("exposes the locked success and minimal-identity HTTP boundary", () => {
    const route = read("server/routes/onboarding.ts");

    expect(route).toContain('router.post("/api/onboarding/complete"');
    expect(route).toContain("completeOutcomeOnboardingSchema");
    expect(route).toContain("error instanceof BusinessIdentityRequiredError");
    expect(route).toContain("error instanceof BusinessSelectionRequiredError");
    expect(route).toContain("error instanceof BusinessProfileSelectionRequiredError");
    expect(route).toContain("error instanceof BusinessOwnershipConflictError");
    expect(route).toContain("res.status(422)");
    expect(route).toContain("code: error.code");
    expect(route).toContain("missing: [...error.missing]");
    expect(route).toContain("return res.json({ success: true, result })");
  });

  it("wires the atomic repository through the production storage boundary", () => {
    const storage = read("server/storage.ts");

    expect(storage).toContain("new OutcomeOnboardingRepository()");
    expect(storage).toContain("completeOutcomeBusinessProfile(");
    expect(storage).toContain("outcomeOnboardingRepository.completeBusinessProfile(args)");
    expect(storage).toContain("completeOutcomeExpressResult(");
    expect(storage).toContain("outcomeOnboardingRepository.completeExpressResult(args)");
  });
});
