import { describe, expect, it } from "vitest";
import {
  ADMIN_MANAGED_PROFILE_SOURCE,
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
  canDiscoverPublishedProfilePublicly,
  canServePublishedProfileAtDirectRoute,
  derivePublishedProfileExposure,
} from "../services/ownerConfirmedDirectProfile";
import {
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_STEWARD_PROVIDER,
} from "@shared/precisionAerialProfile";
import { shouldIndexPublicProfileSlug } from "@shared/publicProfileIndexing";
import {
  STEEL_HOME_PACKAGES_PROFILE_IDENTITY,
  STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE,
} from "@shared/steelHomePackagesProfile";

function businessCandidate(overrides: Record<string, unknown> = {}) {
  const profileId = String(overrides.profileId || "profile-1");
  return {
    profileId,
    businessId: "business-1",
    profileSlug: "local-business",
    profileStatus: "published",
    profileRoleContext: "business_owner",
    profileHeadline: "A real local business profile.",
    profileContentBlocks: [{ type: "about", data: { text: "Useful public details." } }],
    profileOwnerUserId: "owner-1",
    ownerRole: "business_owner",
    ownerRoles: ["business_owner"],
    ownerVerifiedBadge: false,
    ownerVerificationStatus: "approved",
    ownerProvider: "local",
    ownerPreferences: {
      profileVisibility: "private",
      publicProfileIds: [profileId],
    },
    businessStatus: "active",
    businessOwnerUserId: "owner-1",
    publicDiscoveryEnabled: true,
    businessSources: [],
    businessClaimStatus: "claimed",
    ...overrides,
  };
}

function personalCandidate(overrides: Record<string, unknown> = {}) {
  const profileId = String(overrides.profileId || "personal-profile-1");
  return {
    profileId,
    businessId: null,
    profileSlug: "local-homeowner",
    profileStatus: "published",
    profileRoleContext: "homeowner",
    profileHeadline: "Sharing a documented local renovation.",
    profileContentBlocks: [{ type: "about", data: { text: "A real public profile story." } }],
    profileOwnerUserId: "owner-1",
    ownerRole: "homeowner",
    ownerRoles: ["homeowner"],
    ownerVerifiedBadge: false,
    ownerVerificationStatus: "pending",
    ownerProvider: "local",
    ownerPreferences: {
      profileVisibility: "private",
      publicProfileIds: [profileId],
    },
    businessStatus: null,
    businessOwnerUserId: null,
    publicDiscoveryEnabled: null,
    businessSources: null,
    businessClaimStatus: null,
    ...overrides,
  };
}

describe("public profile publication safety", () => {
  it("does not treat account-wide public visibility as release of every personal profile", () => {
    expect(
      derivePublishedProfileExposure(
        personalCandidate({
          ownerPreferences: { profileVisibility: "public", publicProfileIds: [] },
        })
      )
    ).toEqual({
      mode: "private",
      reason: "personal_profile_not_explicitly_released",
    });
  });

  it("allows an eligible personal profile only after exact per-profile release", () => {
    expect(derivePublishedProfileExposure(personalCandidate())).toEqual({
      mode: "public",
      reason: "public",
    });
  });

  it("keeps an explicitly released but empty personal profile private", () => {
    expect(
      derivePublishedProfileExposure(
        personalCandidate({
          profileHeadline: null,
          profileContentBlocks: [],
          profileServicesDescription: null,
        })
      )
    ).toEqual({ mode: "private", reason: "empty_profile" });
  });

  it.each([
    ["reserved slug", { profileSlug: "tradescout-admin" }],
    ["profile role", { profileSlug: "staff-profile", profileRoleContext: "super_admin" }],
    ["owner role", { profileSlug: "staff-personal", ownerRole: "ops_admin", ownerRoles: ["ops_admin"] }],
  ])("keeps an internal profile private by %s", (_label, override) => {
    expect(derivePublishedProfileExposure(personalCandidate(override))).toEqual({
      mode: "private",
      reason: "internal_role",
    });
  });

  it.each(["jw-stone", "issa-build", "la-plumbing-solutions", "red-graniti"])(
    "keeps the approved discoverable business %s public",
    (profileSlug) => {
      const candidate = businessCandidate({ profileSlug });
      expect(derivePublishedProfileExposure(candidate)).toEqual({
        mode: "public",
        reason: "public",
      });
      expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(true);
      expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(true);
    }
  );

  it("preserves JR's exact owner-confirmed route but keeps it out of discovery and indexing", () => {
    const candidate = businessCandidate({
      profileSlug: JRS_PROFILE_SLUG,
      ownerVerificationStatus: "pending",
      publicDiscoveryEnabled: false,
      businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
    });

    expect(derivePublishedProfileExposure(candidate)).toEqual({
      mode: "direct_only",
      reason: "direct_only",
    });
    expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(true);
    expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(false);
    expect(shouldIndexPublicProfileSlug(JRS_PROFILE_SLUG)).toBe(false);
  });

  it("preserves Precision Aerial only with its exact pending-owner stewardship evidence", () => {
    const candidate = businessCandidate({
      profileSlug: PRECISION_AERIAL_PROFILE_SLUG,
      ownerVerificationStatus: "pending",
      ownerProvider: PRECISION_AERIAL_STEWARD_PROVIDER,
      ownerPreferences: {
        profileVisibility: "public",
        publicProfileIds: ["profile-1"],
        internalProfileSteward: {
          profileSlug: PRECISION_AERIAL_PROFILE_SLUG,
          source: ADMIN_MANAGED_PROFILE_SOURCE,
        },
      },
      publicDiscoveryEnabled: false,
      businessClaimStatus: "unclaimed",
      businessSources: [ADMIN_MANAGED_PROFILE_SOURCE],
    });

    expect(derivePublishedProfileExposure(candidate)).toEqual({
      mode: "direct_only",
      reason: "direct_only",
    });
    expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(true);
    expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(false);
    expect(shouldIndexPublicProfileSlug(PRECISION_AERIAL_PROFILE_SLUG)).toBe(false);

    expect(
      derivePublishedProfileExposure({
        ...candidate,
        ownerPreferences: {
          profileVisibility: "public",
          publicProfileIds: ["profile-1"],
        },
      })
    ).toEqual({ mode: "private", reason: "business_trust_missing" });
  });

  it("keeps Moulding & Millwork unavailable while ownership or stewardship trust is missing", () => {
    const candidate = businessCandidate({
      profileSlug: "moulding-millwork-supply",
      ownerVerificationStatus: "pending",
      ownerVerifiedBadge: false,
      businessSources: ["operator_confirmed_selective_inheritance"],
    });

    expect(derivePublishedProfileExposure(candidate)).toEqual({
      mode: "private",
      reason: "business_trust_missing",
    });
    expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(false);
  });

  it("preserves Steel Home as exact-link unlisted review and never indexes it", () => {
    const candidate = businessCandidate({
      profileId: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.id,
      profileSlug: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug,
      profileOwnerUserId: "admin-owner",
      ownerRole: "super_admin",
      ownerRoles: ["super_admin"],
      ownerVerificationStatus: "approved",
      ownerPreferences: {
        profileVisibility: "public",
        publicProfileIds: [STEEL_HOME_PACKAGES_PROFILE_IDENTITY.id],
      },
      businessStatus: "draft",
      businessOwnerUserId: "admin-owner",
      publicDiscoveryEnabled: false,
      businessClaimStatus: "unclaimed",
      businessSources: [STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE],
    });

    expect(derivePublishedProfileExposure(candidate)).toEqual({
      mode: "unlisted_review",
      reason: "unlisted_review",
    });
    expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(true);
    expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(false);
    expect(shouldIndexPublicProfileSlug(STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug)).toBe(false);
  });
});
