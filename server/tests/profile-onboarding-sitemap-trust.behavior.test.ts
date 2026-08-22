import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ProfileSitemapEligibilityCandidate,
  shouldIncludePublicProfileInSitemap,
} from "../repositories/sitemapRepository";
import {
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
} from "../services/ownerConfirmedDirectProfile";
import { isPublishedProfileSitemapTargetPublic } from "../routes/profiles";

const baseCandidate: ProfileSitemapEligibilityCandidate = {
  profileId: "profile-1",
  slug: "onboarded-business",
  businessId: "business-1",
  profileRoleContext: "business_owner",
  profileHeadline: "A real local business profile.",
  profileContentBlocks: [{ type: "about", data: { text: "Useful public details." } }],
  profileOwnerUserId: "owner-1",
  ownerVerifiedBadge: false,
  ownerVerificationStatus: "pending",
  ownerProvider: "local",
  ownerPreferences: { profileVisibility: "public", publicProfileIds: ["profile-1"] },
  businessStatus: "active",
  businessOwnerUserId: "owner-1",
  publicDiscoveryEnabled: false,
  businessSources: ["onboarding_profile_intake"],
  businessClaimStatus: "claimed",
};

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("onboarding profile sitemap trust boundary", () => {
  it("retains published public community profiles that have no linked business", () => {
    expect(
      shouldIncludePublicProfileInSitemap({
        ...baseCandidate,
        slug: "community-member",
        businessId: null,
        profileRoleContext: "homeowner",
      })
    ).toBe(true);
  });

  it("honors exact per-profile visibility without exposing sibling profiles", () => {
    expect(
      shouldIncludePublicProfileInSitemap({
        ...baseCandidate,
        ownerVerificationStatus: "approved",
        ownerPreferences: { publicProfileIds: ["profile-1"] },
        publicDiscoveryEnabled: true,
      })
    ).toBe(true);
    expect(
      shouldIncludePublicProfileInSitemap({
        ...baseCandidate,
        profileId: "profile-2",
        ownerVerificationStatus: "approved",
        ownerPreferences: { publicProfileIds: ["profile-1"] },
      })
    ).toBe(false);
  });

  it("omits an unverified linked business profile even if discovery was toggled on", () => {
    expect(shouldIncludePublicProfileInSitemap(baseCandidate)).toBe(false);
    expect(
      shouldIncludePublicProfileInSitemap({
        ...baseCandidate,
        publicDiscoveryEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldIncludePublicProfileInSitemap({
        ...baseCandidate,
        businessStatus: null,
        businessOwnerUserId: null,
      })
    ).toBe(false);
  });

  it("retains linked profiles whose owner passes the existing verification gate", () => {
    expect(
      shouldIncludePublicProfileInSitemap({
        ...baseCandidate,
        ownerVerificationStatus: " APPROVED ",
        publicDiscoveryEnabled: true,
      })
    ).toBe(true);
    expect(
      shouldIncludePublicProfileInSitemap({
        ...baseCandidate,
        ownerVerifiedBadge: true,
        ownerVerificationStatus: "pending",
        publicDiscoveryEnabled: true,
      })
    ).toBe(true);
    expect(
      shouldIncludePublicProfileInSitemap({
        ...baseCandidate,
        ownerVerificationStatus: "approved",
        publicDiscoveryEnabled: false,
      })
    ).toBe(false);
  });

  it("keeps the exact owner-confirmed direct-profile exception out of discovery", () => {
    const exactAuthority = {
      ...baseCandidate,
      slug: JRS_PROFILE_SLUG,
      businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
    };

    expect(shouldIncludePublicProfileInSitemap(exactAuthority)).toBe(false);
    expect(
      shouldIncludePublicProfileInSitemap({
        ...exactAuthority,
        slug: "another-business",
      })
    ).toBe(false);
    expect(
      shouldIncludePublicProfileInSitemap({
        ...exactAuthority,
        businessSources: ["onboarding_profile_intake"],
      })
    ).toBe(false);
  });

  it("joins the linked business trust evidence before filtering sitemap rows", () => {
    const repository = read("server/repositories/sitemapRepository.ts");
    const method = repository.slice(
      repository.indexOf("async listPublicProfilesForSitemap"),
      repository.indexOf("async listBusinessProfilesForSitemap")
    );

    expect(method).toContain("businessId: profiles.businessId");
    expect(method).toContain("profileOwnerUserId: profiles.ownerUserId");
    expect(method).toContain("ownerVerifiedBadge: users.verifiedBadge");
    expect(method).toContain("ownerVerificationStatus: users.verificationStatus");
    expect(method).toContain(".leftJoin(businesses, eq(profiles.businessId, businesses.id))");
    expect(method).toContain(".filter(shouldIncludePublicProfileInSitemap)");
    expect(method).toContain("notInArray(profiles.slug, [...INTERNAL_ADMIN_PROFILE_SLUGS])");
  });

  it("gates the concrete route-level sitemap target used by every profile sitemap", () => {
    const rawTarget = {
      profile_id: "profile-1",
      profile_slug: "onboarded-business",
      business_id: "business-1",
      profile_owner_user_id: "owner-1",
      owner_verified_badge: false,
      owner_verification_status: "pending",
      owner_provider: "local",
      owner_preferences: { publicProfileIds: ["profile-1"] },
      business_status: "active",
      business_owner_user_id: "owner-1",
      public_discovery_enabled: true,
      business_sources: ["selective_intelligence_onboarding"],
      business_claim_status: "claimed",
    };

    expect(isPublishedProfileSitemapTargetPublic(rawTarget)).toBe(false);
    expect(
      isPublishedProfileSitemapTargetPublic({
        ...rawTarget,
        business_id: null,
        profile_role_context: "homeowner",
        profile_headline: "A real local community profile.",
        content_blocks: [{ type: "about", data: { text: "Useful public details." } }],
      })
    ).toBe(true);
    expect(
      isPublishedProfileSitemapTargetPublic({
        ...rawTarget,
        owner_verification_status: "approved",
      })
    ).toBe(true);
    expect(
      isPublishedProfileSitemapTargetPublic({
        ...rawTarget,
        profile_slug: JRS_PROFILE_SLUG,
        public_discovery_enabled: false,
        business_sources: [OWNER_CONFIRMED_PROFILE_SOURCE],
      })
    ).toBe(false);
    expect(
      isPublishedProfileSitemapTargetPublic({
        ...rawTarget,
        owner_preferences: { publicProfileIds: ["another-profile"] },
        owner_verification_status: "approved",
      })
    ).toBe(false);

    const routes = read("server/routes/profiles.ts");
    const targetLoader = routes.slice(
      routes.indexOf("async function listPublishedProfileSitemapTargets"),
      routes.indexOf("async function listPublicBusinessPresenceSitemapRows")
    );
    expect(targetLoader).toContain("p.business_id");
    expect(targetLoader).toContain("p.id AS profile_id");
    expect(targetLoader).toContain("u.verified_badge AS owner_verified_badge");
    expect(targetLoader).toContain("b.sources AS business_sources");
    expect(targetLoader).toContain("isPublishedProfileSitemapTargetPublic(row)");
  });
});
