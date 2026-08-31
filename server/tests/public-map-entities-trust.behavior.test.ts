import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canExposeProviderProfileOnPublicMap } from "../services/ownerConfirmedDirectProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

function providerCandidate(overrides: Record<string, unknown> = {}) {
  return {
    profileId: "profile-1",
    businessId: null,
    profileSlug: "provider-one",
    profileStatus: "published",
    profileRoleContext: "community_builder",
    profileHeadline: "Experienced community provider",
    profileContentBlocks: [],
    profileOwnerUserId: "owner-1",
    ownerVerifiedBadge: false,
    ownerVerificationStatus: "pending",
    ownerProvider: "local",
    ownerPreferences: { publicProfileIds: ["profile-1"] },
    businessStatus: null,
    businessOwnerUserId: null,
    publicDiscoveryEnabled: null,
    businessSources: null,
    businessClaimStatus: null,
    ...overrides,
  };
}

describe("public map entity trust boundary", () => {
  it("does not turn a public personal profile into an unverified provider marker", () => {
    expect(canExposeProviderProfileOnPublicMap(providerCandidate())).toBe(false);
    expect(
      canExposeProviderProfileOnPublicMap(
        providerCandidate({ ownerVerificationStatus: "approved" })
      )
    ).toBe(true);
    expect(
      canExposeProviderProfileOnPublicMap(
        providerCandidate({
          ownerVerificationStatus: "approved",
          ownerPreferences: { publicProfileIds: ["different-profile"] },
        })
      )
    ).toBe(false);
  });

  it("rejects onboarding-created linked profiles until verification passes", () => {
    const linked = providerCandidate({
      businessId: "business-1",
      businessStatus: "active",
      businessOwnerUserId: "owner-1",
      publicDiscoveryEnabled: true,
      businessSources: ["selective_intelligence_onboarding"],
      businessClaimStatus: "claimed",
    });

    expect(canExposeProviderProfileOnPublicMap(linked)).toBe(false);
    expect(
      canExposeProviderProfileOnPublicMap({
        ...linked,
        ownerVerificationStatus: "approved",
      })
    ).toBe(true);
  });

  it("uses complete profile authority and omits fallback provider identity links", () => {
    const routes = read("server/routes.ts");
    const mapEntities = routes.slice(
      routes.indexOf('app.get("/api/map/entities"'),
      routes.indexOf('app.get("/api/map/providers"')
    );
    const repository = read("server/repositories/profileRepository.ts");
    const providerProfiles = repository.slice(
      repository.indexOf("export async function loadCanonicalPublicMapProfileUrls"),
      repository.indexOf("type ProfileMutation")
    );

    expect(providerProfiles).toContain("ownerPreferences: users.preferences");
    expect(providerProfiles).toContain("ownerVerifiedBadge: users.verifiedBadge");
    expect(providerProfiles).toContain("canExposeProviderProfileOnPublicMap(candidate)");
    expect(mapEntities).toContain("loadCanonicalPublicMapProfileUrls(providerIds)");
    expect(mapEntities).toContain("if (!canonicalProfileUrl) continue;");
    expect(mapEntities).not.toContain("`/profile/${encodeURIComponent");
  });

  it("applies the same complete authority gate to the legacy provider endpoint", () => {
    const routes = read("server/routes.ts");
    const mapProviders = routes.slice(
      routes.indexOf('app.get("/api/map/providers"'),
      routes.indexOf("// County contractors endpoint")
    );

    expect(mapProviders).toContain("loadCanonicalPublicMapProfileUrls(");
    expect(mapProviders).toContain(
      "if (!canonicalProfileUrlByProviderId.has(String(row.providerId))) return null;"
    );
    expect(mapProviders.indexOf("loadCanonicalPublicMapProfileUrls(")).toBeLessThan(
      mapProviders.indexOf("const providers = rows")
    );
  });

  it("filters claimed-unverified business markers in SQL before limiting", () => {
    const routes = read("server/routes.ts");
    const mapEntities = routes.slice(
      routes.indexOf('app.get("/api/map/entities"'),
      routes.indexOf('app.get("/api/map/providers"')
    );
    const businessLayer = mapEntities.slice(mapEntities.indexOf('if (wants("business"))'));

    expect(businessLayer).toContain("eq(businesses.publicDiscoveryEnabled, true as any)");
    expect(businessLayer).toContain("publicBusinessDetailExposureSqlPredicate()");
    expect(businessLayer.indexOf("publicBusinessDetailExposureSqlPredicate()")).toBeLessThan(
      businessLayer.indexOf(".limit(Math.min(limit, 5000))")
    );
  });
});
