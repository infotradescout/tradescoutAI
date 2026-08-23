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
    ownerPreferences: { profileVisibility: "private", publicProfileIds: [profileId] },
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
          ownerPreferences: { profileVisibility: "public", publicProfileIds: [] },
        })
      )
    ).toEqual({
      mode: "private",
      reason: "personal_profile_not_explicitly_released",
    });
  });

  it("keeps a meaningful released personal profile exact-link-only until a crawlable hub exists", () => {
    expect(derivePublishedProfileExposure(personalCandidate())).toEqual({
      mode: "direct_only",
      reason: "direct_only",
    });
    expect(canServePublishedProfileAtDirectRoute(personalCandidate())).toBe(true);
    expect(canDiscoverPublishedProfilePublicly(personalCandidate())).toBe(false);
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

  it.each(["businessDraft", "profileBooking", "profileSections", "siteTemplate", "customConfig"])(
    "does not treat internal %s configuration as public profile content",
    (type) => {
      expect(
        derivePublishedProfileExposure(
          personalCandidate({
            profileHeadline: null,
            profileServicesDescription: null,
            profileContentBlocks: [{ type, data: { owner: "keep", amount: 100 } }],
          })
        )
      ).toEqual({ mode: "private", reason: "empty_profile" });
    }
  );

  it.each(["about", "services", "gallery"])(
    "accepts meaningful allowlisted %s content for an exact-link-only released profile",
    (type) => {
      expect(
        derivePublishedProfileExposure(
          personalCandidate({
            profileHeadline: null,
            profileServicesDescription: null,
            profileContentBlocks: [{ type, data: { text: "Useful public detail" } }],
          })
        )
      ).toEqual({ mode: "direct_only", reason: "direct_only" });
    }
  );

  it.each([
    { layout: "split" },
    { columns: 3 },
    { id: "private-record-id" },
    { items: [{ id: "private-record-id", layout: "card" }] },
  ])("does not treat allowlisted config-only block data as substantive: %j", (data) => {
    expect(
      derivePublishedProfileExposure(
        personalCandidate({
          profileHeadline: null,
          profileServicesDescription: null,
          profileContentBlocks: [{ type: "about", data }],
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

  it("keeps an empty linked business profile exact-link-only and out of discovery", () => {
    const candidate = businessCandidate({
      profileHeadline: null,
      profileServicesDescription: null,
      profileContentBlocks: [],
    });

    expect(derivePublishedProfileExposure(candidate)).toEqual({
      mode: "direct_only",
      reason: "empty_profile",
    });
    expect(canServePublishedProfileAtDirectRoute(candidate)).toBe(true);
    expect(canDiscoverPublishedProfilePublicly(candidate)).toBe(false);
  });

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

  it("keeps Moulding & Millwork blocked while custody trust is missing", () => {
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
  });
});
