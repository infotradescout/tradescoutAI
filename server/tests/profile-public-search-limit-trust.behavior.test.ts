import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canExposeLinkedBusinessProfilePublicly } from "../services/ownerConfirmedDirectProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

function linkedCandidate(overrides: Record<string, unknown> = {}) {
  return {
    businessId: "business-1",
    profileSlug: "matching-business",
    profileStatus: "published",
    profileOwnerUserId: "owner-1",
    ownerVerifiedBadge: false,
    ownerVerificationStatus: "pending",
    ownerProvider: "local",
    ownerPreferences: {},
    businessStatus: "active",
    businessOwnerUserId: "owner-1",
    publicDiscoveryEnabled: true,
    businessSources: ["selective_intelligence_onboarding"],
    businessClaimStatus: "claimed",
    ...overrides,
  };
}

describe("public profile search trust limit", () => {
  it("does not let newer pending onboarding matches crowd verified matches out of the limit", () => {
    const newestFirst = [
      linkedCandidate({ profileSlug: "pending-1" }),
      linkedCandidate({ profileSlug: "pending-2" }),
      linkedCandidate({ profileSlug: "pending-3" }),
      linkedCandidate({ profileSlug: "verified-1", ownerVerificationStatus: "approved" }),
      linkedCandidate({ profileSlug: "verified-2", ownerVerifiedBadge: true }),
    ];

    const oldPostLimitFiltering = newestFirst
      .slice(0, 2)
      .filter(canExposeLinkedBusinessProfilePublicly);
    const trustBeforeLimit = newestFirst.filter(canExposeLinkedBusinessProfilePublicly).slice(0, 2);

    expect(oldPostLimitFiltering).toHaveLength(0);
    expect(trustBeforeLimit.map((row) => row.profileSlug)).toEqual(["verified-1", "verified-2"]);
  });

  it("places explicit release, discovery, and trust predicates in SQL before order and limit", () => {
    const repository = read("server/repositories/profileRepository.ts");
    const search = repository.slice(
      repository.indexOf("async searchProfilesPublic"),
      repository.indexOf("async createProfileForOwner")
    );
    const predicate = repository.slice(
      repository.indexOf("function publicProfileSearchExposurePredicate"),
      repository.indexOf("export class ProfileRepository")
    );

    expect(search.indexOf("publicProfileSearchExposurePredicate()")).toBeLessThan(
      search.indexOf(".orderBy(")
    );
    expect(search.indexOf("publicProfileVisibilityPredicate()")).toBeLessThan(
      search.indexOf(".orderBy(")
    );
    expect(search.indexOf(".orderBy(")).toBeLessThan(search.indexOf(".limit(limit)"));
    expect(predicate).toContain("eq(profiles.publiclyReleased, true)");
    expect(predicate).toContain("durableProfessionalProfileApprovalSql");
    expect(predicate).toContain("${profiles.ownerUserId} = ${businesses.ownerUserId}");
    expect(predicate).toContain("${profiles.businessId} IS NOT NULL");
    expect(predicate).toContain("${businesses.status} = 'active'");
    expect(predicate).toContain("${businesses.publicDiscoveryEnabled} = true");
    expect(predicate).toContain("${users.verifiedBadge} = true");
    expect(predicate).toContain("${users.verificationStatus}");
    expect(predicate).not.toContain("profileVisibility");
    expect(predicate).not.toContain("OWNER_CONFIRMED_PROFILE_SOURCE");
    expect(predicate).not.toContain("ADMIN_MANAGED_PROFILE_SOURCE");
    expect(predicate).not.toContain("internalProfileSteward");
  });

  it("returns only public-safe fields without route-level owner lookups", () => {
    const repository = read("server/repositories/profileRepository.ts");
    const routes = read("server/routes/profiles.ts");
    const search = repository.slice(
      repository.indexOf("async searchProfilesPublic"),
      repository.indexOf("async createProfileForOwner")
    );
    const route = routes.slice(
      routes.indexOf('router.get("/api/profiles/public-search"'),
      routes.indexOf('router.get("/api/profiles/:id/profile-booking"')
    );

    expect(search).not.toContain("ownerUserId: profiles.ownerUserId");
    expect(search).not.toContain("businessId: profiles.businessId");
    expect(route).not.toContain("await db");
    expect(route).not.toContain("ownerUserId");
    expect(route).not.toContain("businessId");
  });
});
