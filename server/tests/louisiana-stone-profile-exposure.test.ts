import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LOUISIANA_STONE_SOLUTIONS_PROFILE_SLUG } from "@shared/louisianaStoneSolutionsProfile";
import {
  ADMIN_MANAGED_PROFILE_SOURCE,
  getDirectProfileAuthority,
  OWNER_CONFIRMED_PROFILE_SOURCE,
} from "@shared/publicProfileExposureRegistry";
import { shouldIndexPublicProfileSlug } from "@shared/publicProfileIndexing";
import {
  canDiscoverPublishedProfilePublicly,
  canExposeLinkedBusinessProfilePublicly,
  canExposeProviderProfileOnPublicMap,
  canExposePublishedProfilePublicly,
  canServePublishedProfileAtDirectRoute,
  derivePublishedProfileExposure,
  isOwnerConfirmedDirectProfile,
  type PublishedProfileExposureCandidate,
} from "../services/ownerConfirmedDirectProfile";

const { loadPublicProfile } = vi.hoisted(() => ({ loadPublicProfile: vi.fn() }));
vi.mock("../storage", () => ({
  storage: { getProfileBySlugPublic: loadPublicProfile },
}));
vi.mock("../repositories/sitemapRepository", () => ({ SitemapRepository: vi.fn() }));

import { collectProfileImageSitemapEntries } from "../profileImageSitemap";
import { buildPublicProfileSitemapXml } from "../publicProfileHtml";

function companyCandidate(
  overrides: Partial<PublishedProfileExposureCandidate> = {}
): PublishedProfileExposureCandidate {
  return {
    profileId: "synthetic-company-profile",
    businessId: "synthetic-company-business",
    profileSlug: LOUISIANA_STONE_SOLUTIONS_PROFILE_SLUG,
    profileStatus: "published",
    profileRoleContext: "business_owner",
    profileHeadline: "Countertop services",
    profileContentBlocks: [{ type: "about", data: { text: "Company service information." } }],
    profileOwnerUserId: "synthetic-company-owner",
    ownerRole: "business_owner",
    ownerRoles: ["business_owner"],
    ownerVerifiedBadge: false,
    ownerVerificationStatus: "pending",
    ownerProvider: "local",
    ownerEmailVerified: true,
    ownerPreferences: {
      profileVisibility: "private",
      publicProfileIds: ["synthetic-company-profile"],
    },
    businessStatus: "active",
    businessOwnerUserId: "synthetic-company-owner",
    publicDiscoveryEnabled: false,
    businessSources: [ADMIN_MANAGED_PROFILE_SOURCE],
    businessClaimStatus: "claimed",
    businessProfileData: { contactManagement: "business_managed", publicContactEnabled: false },
    ...overrides,
  };
}

describe("Louisiana Stone Solutions exact direct-profile release", () => {
  it.each(["pending", "approved"])(
    "permits the assigned, mailbox-confirmed company with %s business verification only at its direct URL",
    (ownerVerificationStatus) => {
      const candidate = companyCandidate({ ownerVerificationStatus });
      const before = structuredClone(candidate);

      expect(getDirectProfileAuthority(candidate.profileSlug)).toBe(ADMIN_MANAGED_PROFILE_SOURCE);
      expect(isOwnerConfirmedDirectProfile(candidate)).toBe(true);
      expect(canExposeLinkedBusinessProfilePublicly(candidate)).toBe(true);
      expect(derivePublishedProfileExposure(candidate)).toEqual({
        mode: "direct_only",
        reason: "direct_only",
      });
      expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(true);
      expect(canExposePublishedProfilePublicly(candidate)).toBe(true);
      expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(false);
      expect(canExposeProviderProfileOnPublicMap(candidate)).toBe(false);
      expect(shouldIndexPublicProfileSlug(candidate.profileSlug)).toBe(false);
      expect(candidate).toEqual(before);
      expect(candidate.ownerVerifiedBadge).toBe(false);
    }
  );

  const deniedAuthority: Array<[string, Partial<PublishedProfileExposureCandidate>]> = [
    ["mailbox verification revoked", { ownerEmailVerified: false }],
    ["mailbox verification missing", { ownerEmailVerified: undefined }],
    ["mailbox flag is a string", { ownerEmailVerified: "true" }],
    ["unclaimed business", { businessClaimStatus: "unclaimed" }],
    ["owner transfer still pending", { businessClaimStatus: "owner_confirmed_pending_transfer" }],
    ["claim state missing", { businessClaimStatus: null }],
    ["internal profile steward", { ownerProvider: "admin_provisioned_profile_steward" }],
    ["admin-provisioned provider shortcut", { ownerProvider: "admin_provisioned" }],
    ["unknown provider", { ownerProvider: undefined }],
    ["rejected business verification", { ownerVerificationStatus: "rejected" }],
    ["expired business verification", { ownerVerificationStatus: "expired" }],
    ["suspended business verification", { ownerVerificationStatus: "suspended" }],
    ["unknown business verification", { ownerVerificationStatus: "unknown" }],
    ["missing business verification", { ownerVerificationStatus: undefined }],
    ["draft profile", { profileStatus: "draft" }],
    ["inactive business", { businessStatus: "suspended" }],
    ["mismatched business owner", { businessOwnerUserId: "synthetic-other-owner" }],
    ["empty owner pair", { businessOwnerUserId: "", profileOwnerUserId: "" }],
    ["discovery enabled", { publicDiscoveryEnabled: true }],
    ["discovery state missing", { publicDiscoveryEnabled: undefined }],
    ["admin release source revoked", { businessSources: [] }],
    ["invented owner-confirmation source", { businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE] }],
    ["malformed source list", { businessSources: ADMIN_MANAGED_PROFILE_SOURCE }],
    ["different unregistered slug", { profileSlug: "synthetic-other-stone-company" }],
  ];

  it.each(deniedAuthority)("fails closed for %s", (_label, override) => {
    const candidate = companyCandidate(override);
    expect(isOwnerConfirmedDirectProfile(candidate)).toBe(false);
    expect(canExposeLinkedBusinessProfilePublicly(candidate)).toBe(false);
    expect(derivePublishedProfileExposure(candidate).mode).toBe("private");
    expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(false);
    expect(canExposePublishedProfilePublicly(candidate)).toBe(false);
    expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(false);
    expect(canExposeProviderProfileOnPublicMap(candidate)).toBe(false);
  });

  it.each([
    { profileVisibility: "public" },
    { profileVisibility: "public", publicProfileIds: [] },
    { profileVisibility: "public", publicProfileIds: ["synthetic-sibling-profile"] },
  ])(
    "requires deliberate release of this profile despite account-wide visibility",
    (preferences) => {
      const candidate = companyCandidate({ ownerPreferences: preferences });
      expect(derivePublishedProfileExposure(candidate)).toEqual({
        mode: "private",
        reason: "private",
      });
      expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(false);
      expect(canExposePublishedProfilePublicly(candidate)).toBe(false);
    }
  );

  it.each([
    { ownerEmailVerified: false },
    { businessClaimStatus: "unclaimed" },
    { ownerProvider: "admin_provisioned_profile_steward" },
    { businessOwnerUserId: "synthetic-other-owner" },
    { businessSources: [] },
    { publicDiscoveryEnabled: true },
    { ownerVerificationStatus: "rejected" },
  ])(
    "does not recover revoked LSS authority through a badge or generic approved-owner fallback",
    (override) => {
      const candidate = companyCandidate({
        ownerVerifiedBadge: true,
        ownerVerificationStatus: "approved",
        ...override,
      });
      expect(derivePublishedProfileExposure(candidate).mode).toBe("private");
      expect(canExposeLinkedBusinessProfilePublicly(candidate)).toBe(false);
      expect(canExposePublishedProfilePublicly(candidate)).toBe(false);
      expect(canExposeProviderProfileOnPublicMap(candidate)).toBe(false);
    }
  );

  it.each([null, undefined, "", "   "])(
    "rejects a detached LSS business even when reclassified as a meaningful public personal profile (%s)",
    (businessId) => {
      const candidate = companyCandidate({
        businessId,
        profileRoleContext: "homeowner",
        ownerRole: "homeowner",
        ownerRoles: ["homeowner"],
        ownerVerifiedBadge: true,
        ownerVerificationStatus: "approved",
      });
      expect(derivePublishedProfileExposure(candidate).mode).toBe("private");
      expect(canExposeLinkedBusinessProfilePublicly(candidate)).toBe(false);
      expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(false);
      expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(false);
    }
  );

  it("keeps registered direct pages out of actual page and image sitemap builders", async () => {
    loadPublicProfile.mockClear();
    expect(
      await buildPublicProfileSitemapXml({
        slug: LOUISIANA_STONE_SOLUTIONS_PROFILE_SLUG,
        origin: "https://synthetic-company.example.test",
      })
    ).toBeNull();
    expect(
      collectProfileImageSitemapEntries({
        candidate: {
          slug: LOUISIANA_STONE_SOLUTIONS_PROFILE_SLUG,
          seoMeta: { imageUrl: "/uploads/synthetic-company-cover.jpg" },
          contentBlocks: [],
        },
        profileUrl: "https://synthetic-company.example.test/",
      })
    ).toEqual([]);
    expect(loadPublicProfile).not.toHaveBeenCalled();
  });

  it("leaves unrelated verified business discovery unchanged", () => {
    const candidate = companyCandidate({
      profileSlug: "synthetic-other-stone-company",
      ownerVerificationStatus: "approved",
      publicDiscoveryEnabled: true,
      businessSources: [],
    });
    expect(getDirectProfileAuthority(candidate.profileSlug)).toBeNull();
    expect(derivePublishedProfileExposure(candidate).mode).toBe("public");
    expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(true);
    expect(canExposeProviderProfileOnPublicMap(candidate)).toBe(true);
  });

  it("passes mailbox and verification state to the profile contact authority check", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/profiles.ts"),
      "utf8"
    );
    const context = source.slice(
      source.indexOf("export async function getPublicProfileTrustContext")
    );
    const candidate = context.match(/isOwnerConfirmedDirectProfile\(\{([\s\S]*?)\}\)/)?.[1];
    expect(candidate).toBeDefined();
    expect(candidate).toContain("ownerEmailVerified: ownerUser.emailVerified");
    expect(candidate).toContain("ownerVerificationStatus: ownerUser.verificationStatus");
  });
});
