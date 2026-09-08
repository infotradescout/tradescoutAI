import { describe, expect, it } from "vitest";
import { derivePublishedProfileExposure } from "../services/ownerConfirmedDirectProfile";

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    profileId: "profile-1",
    profilePubliclyReleased: false,
    businessId: "business-1",
    profileSlug: "local-business",
    profileStatus: "published",
    profileRoleContext: "business_owner",
    profileHeadline: "A real local business.",
    profileContentBlocks: [{ type: "about", data: { text: "Useful details." } }],
    profileOwnerUserId: "owner-1",
    ownerRole: "business_owner",
    ownerRoles: ["business_owner"],
    ownerVerifiedBadge: false,
    ownerVerificationStatus: "approved",
    ownerProvider: "local",
    ownerPreferences: { profileVisibility: "public", publicProfileIds: [] },
    businessStatus: "active",
    businessOwnerUserId: "owner-1",
    publicDiscoveryEnabled: true,
    businessSources: [],
    businessClaimStatus: "claimed",
    ...overrides,
  };
}

describe("explicit business profile release", () => {
  it("does not publish a business merely because the owner account is public", () => {
    expect(derivePublishedProfileExposure(candidate())).toEqual({
      mode: "private",
      reason: "private",
    });
  });

  it("publishes the same verified business after exact profile release", () => {
    expect(
      derivePublishedProfileExposure(
        candidate({
          profilePubliclyReleased: true,
          ownerPreferences: {
            profileVisibility: "private",
            publicProfileIds: ["profile-1"],
          },
        })
      )
    ).toEqual({ mode: "public", reason: "public" });
  });
});
