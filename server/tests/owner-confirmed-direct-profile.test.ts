import { describe, expect, it } from "vitest";
import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
} from "@shared/mouldingMillworkProfile";
import {
  ADMIN_MANAGED_PROFILE_SOURCE,
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
  PRO_FAB_PROFILE_SLUG,
  isOwnerConfirmedDirectProfile,
} from "../services/ownerConfirmedDirectProfile";

const approvedCandidate = {
  profileSlug: JRS_PROFILE_SLUG,
  profileStatus: "published",
  profileOwnerUserId: "owner-1",
  businessStatus: "active",
  businessOwnerUserId: "owner-1",
  publicDiscoveryEnabled: false,
  businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
};

describe("owner-confirmed direct profile authority", () => {
  it("allows only the explicitly provisioned JR profile without general directory exposure", () => {
    expect(isOwnerConfirmedDirectProfile(approvedCandidate)).toBe(true);
  });

  it.each([
    ["another profile", { profileSlug: "another-profile" }],
    ["draft profile", { profileStatus: "draft" }],
    ["inactive business", { businessStatus: "suspended" }],
    ["directory-discoverable business", { publicDiscoveryEnabled: true }],
    ["mismatched owner", { businessOwnerUserId: "owner-2" }],
    ["missing authority marker", { businessSources: [] }],
  ])("rejects %s", (_label, override) => {
    expect(isOwnerConfirmedDirectProfile({ ...approvedCandidate, ...override })).toBe(false);
  });

  it("allows the explicit Pro Fab admin-managed profile without treating another source as authority", () => {
    const proFabCandidate = {
      ...approvedCandidate,
      profileSlug: PRO_FAB_PROFILE_SLUG,
      businessSources: [ADMIN_MANAGED_PROFILE_SOURCE],
    };

    expect(isOwnerConfirmedDirectProfile(proFabCandidate)).toBe(true);
    expect(
      isOwnerConfirmedDirectProfile({
        ...proFabCandidate,
        businessSources: [OWNER_CONFIRMED_PROFILE_SOURCE],
      })
    ).toBe(false);
  });

  it("does not let the Pro Fab authority marker authorize another direct-profile slug", () => {
    expect(
      isOwnerConfirmedDirectProfile({
        ...approvedCandidate,
        businessSources: [ADMIN_MANAGED_PROFILE_SOURCE],
      })
    ).toBe(false);
  });

  it("does not misclassify an operator-confirmed TradePartner as owner-confirmed", () => {
    expect(
      isOwnerConfirmedDirectProfile({
        ...approvedCandidate,
        profileSlug: MOULDING_MILLWORK_PROFILE_SLUG,
        publicDiscoveryEnabled: true,
        businessSources: [MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE],
      })
    ).toBe(false);
  });
});
