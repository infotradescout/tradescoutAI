import { describe, expect, it } from "vitest";
import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
} from "@shared/mouldingMillworkProfile";
import { isOperatorConfirmedTradePartnerProfile } from "../services/operatorConfirmedTradePartnerProfile";

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    profileSlug: MOULDING_MILLWORK_PROFILE_SLUG,
    profileStatus: "published",
    profileOwnerUserId: "owner-1",
    businessStatus: "active",
    businessOwnerUserId: "owner-1",
    publicDiscoveryEnabled: true,
    businessSources: [MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE],
    businessProfileData: { tradePartner: true },
    ownerVerificationStatus: "pending",
    ownerEmailVerified: false,
    ownerProvider: "admin_provisioned",
    ...overrides,
  };
}

describe("operator-confirmed TradePartner profile authority", () => {
  it("accepts only the exact account-controlled Moulding & Millwork profile", () => {
    expect(isOperatorConfirmedTradePartnerProfile(candidate())).toBe(true);
    expect(
      isOperatorConfirmedTradePartnerProfile(
        candidate({ ownerProvider: "local", ownerEmailVerified: true })
      )
    ).toBe(true);
  });

  it.each([
    { profileSlug: "lookalike" },
    { profileStatus: "draft" },
    { businessStatus: "suspended" },
    { publicDiscoveryEnabled: false },
    { businessProfileData: { tradePartner: false } },
    { businessSources: [] },
    {
      businessSources: [
        MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
        MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
      ],
    },
    { ownerVerificationStatus: "rejected" },
    { ownerVerificationStatus: "expired" },
    { ownerVerificationStatus: "suspended" },
    { businessOwnerUserId: "other-owner" },
    { profileOwnerUserId: null },
    { ownerProvider: "local", ownerEmailVerified: false, ownerVerificationStatus: "pending" },
  ])("rejects missing or contradictory authority %#", (override) => {
    expect(isOperatorConfirmedTradePartnerProfile(candidate(override))).toBe(false);
  });
});
