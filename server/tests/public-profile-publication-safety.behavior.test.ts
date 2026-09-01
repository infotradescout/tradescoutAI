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
import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
} from "@shared/mouldingMillworkProfile";

function businessCandidate(overrides: Record<string, unknown> = {}) {
  const profileId = String(overrides.profileId || "profile-1");
  return {
    profileId,
    profilePubliclyReleased: true,
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
    ownerEmailVerified: false,
    ownerProvider: "local",
    ownerPreferences: { profileVisibility: "private", publicProfileIds: [profileId] },
    businessStatus: "active",
    businessOwnerUserId: "owner-1",
    publicDiscoveryEnabled: true,
    businessSources: [],
    businessClaimStatus: "claimed",
    businessProfileData: {},
    ...overrides,
  };
}

function personalCandidate(overrides: Record<string, unknown> = {}) {
  const profileId = String(overrides.profileId || "personal-profile-1");
  return {
    profileId,
    profilePubliclyReleased: true,
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
    ownerPreferences: { profileVisibility: "private", publicProfileIds: [profileId] },
    businessStatus: null,
    businessOwnerUserId: null,
    publicDiscoveryEnabled: null,
    businessSources: null,
    businessClaimStatus: null,
    ...overrides,
  };
}

describe("public profile publication safety", () => {
  it("ignores account-wide public visibility without exact profile release", () => {
    expect(
      derivePublishedProfileExposure(
        personalCandidate({
          profilePubliclyReleased: false,
          ownerPreferences: { profileVisibility: "public", publicProfileIds: [] },
        })
      )
    ).toEqual({
      mode: "private",
      reason: "personal_profile_not_explicitly_released",
    });
  });

  it("allows a meaningful personal profile only after exact release", () => {
    expect(derivePublishedProfileExposure(personalCandidate())).toEqual({
      mode: "public",
      reason: "public",
    });
  });

  it("keeps an explicitly released but empty profile private", () => {
    expect(
      derivePublishedProfileExposure(
        personalCandidate({
          profileHeadline: null,
          profileServicesDescription: null,
          profileContentBlocks: [],
        })
      )
    ).toEqual({ mode: "private", reason: "empty_profile" });
  });

  it.each([
    { profileSlug: "tradescout-admin" },
    { profileSlug: "staff-profile", profileRoleContext: "super_admin" },
    { profileSlug: "staff-personal", ownerRole: "ops_admin", ownerRoles: ["ops_admin"] },
  ])("keeps internal/admin identity private", (override) => {
    expect(derivePublishedProfileExposure(personalCandidate(override))).toEqual({
      mode: "private",
      reason: "internal_role",
    });
  });

  it.each(["jw-stone", "issa-build", "la-plumbing-solutions", "red-graniti"])(
    "keeps approved discoverable business %s public",
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

  it("preserves JR's exact direct route but excludes discovery and indexing", () => {
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

  it("preserves Precision Aerial only with its exact stewardship evidence", () => {
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
        ownerPreferences: { profileVisibility: "public", publicProfileIds: ["profile-1"] },
      })
    ).toEqual({ mode: "private", reason: "business_trust_missing" });
  });

  it("publishes Moulding & Millwork only with exact operator authority and account custody", () => {
    const candidate = businessCandidate({
      profileSlug: MOULDING_MILLWORK_PROFILE_SLUG,
      ownerVerificationStatus: "pending",
      ownerVerifiedBadge: false,
      ownerProvider: "admin_provisioned",
      businessSources: [MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE],
      businessProfileData: { tradePartner: true },
    });

    expect(derivePublishedProfileExposure(candidate)).toEqual({ mode: "public", reason: "public" });
    expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(true);
    expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(true);

    expect(
      derivePublishedProfileExposure({
        ...candidate,
        businessSources: [
          MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
          MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
        ],
      })
    ).toEqual({
      mode: "private",
      reason: "business_trust_missing",
    });
    expect(
      derivePublishedProfileExposure({
        ...candidate,
        businessProfileData: { tradePartner: false },
      })
    ).toEqual({
      mode: "private",
      reason: "business_trust_missing",
    });
  });

  it("preserves Steel Home as unlisted exact-link review", () => {
    const profileId = "steel-home-profile";
    const candidate = businessCandidate({
      profileId,
      profileSlug: STEEL_HOME_PACKAGES_PROFILE_IDENTITY.slug,
      profileOwnerUserId: "admin-owner",
      ownerRole: "super_admin",
      ownerRoles: ["super_admin"],
      ownerVerificationStatus: "approved",
      ownerPreferences: { profileVisibility: "public", publicProfileIds: [profileId] },
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

    expect(
      derivePublishedProfileExposure({
        ...candidate,
        profilePubliclyReleased: false,
      })
    ).toEqual({ mode: "private", reason: "private" });
  });

  it("checks canonical release before the Steel Home unlisted exception", () => {
    const source = String(derivePublishedProfileExposure);
    expect(source.indexOf("isProfileVisibilityPublic")).toBeGreaterThanOrEqual(0);
    expect(source.indexOf("isProfileVisibilityPublic")).toBeLessThan(
      source.indexOf("isSteelHomePackagesUnlistedDirectProfile")
    );
  });
});
