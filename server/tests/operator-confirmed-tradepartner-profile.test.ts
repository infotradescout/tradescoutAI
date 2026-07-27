import { describe, expect, it } from "vitest";
import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
} from "@shared/mouldingMillworkProfile";
import { isOperatorConfirmedTradePartnerProfile } from "../services/operatorConfirmedTradePartnerProfile";

const approvedCandidate = {
  profileSlug: MOULDING_MILLWORK_PROFILE_SLUG,
  profileStatus: "published",
  profileOwnerUserId: "owner-1",
  businessStatus: "active",
  businessOwnerUserId: "owner-1",
  publicDiscoveryEnabled: true,
  businessSources: [MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE],
  businessProfileData: { tradePartner: true },
  ownerProfileVisibility: "public",
  ownerVerificationStatus: "pending",
  ownerEmailVerified: false,
  ownerProvider: "admin_provisioned",
};

describe("operator-confirmed TradePartner profile authority", () => {
  it("allows the exact sourced Moulding & Millwork profile without granting verification", () => {
    expect(isOperatorConfirmedTradePartnerProfile(approvedCandidate)).toBe(true);
  });

  it.each([
    ["another profile", { profileSlug: "another-trade-partner" }],
    ["draft profile", { profileStatus: "draft" }],
    ["inactive business", { businessStatus: "suspended" }],
    ["private discovery", { publicDiscoveryEnabled: false }],
    ["non-TradePartner business", { businessProfileData: { tradePartner: false } }],
    ["private profile", { ownerProfileVisibility: "private" }],
    [
      "revoked operator authority",
      {
        businessSources: [
          MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
          MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
        ],
      },
    ],
    ["rejected account", { ownerVerificationStatus: "rejected" }],
    ["expired account", { ownerVerificationStatus: "expired" }],
    ["suspended account", { ownerVerificationStatus: "suspended" }],
    ["mismatched owner", { businessOwnerUserId: "owner-2" }],
    ["missing authority marker", { businessSources: [] }],
    ["unverified local account", { ownerProvider: "local" }],
  ])("rejects %s", (_label, override) => {
    expect(
      isOperatorConfirmedTradePartnerProfile({
        ...approvedCandidate,
        ...override,
      })
    ).toBe(false);
  });

  it("accepts an email-verified local owner with the exact authority evidence", () => {
    expect(
      isOperatorConfirmedTradePartnerProfile({
        ...approvedCandidate,
        ownerEmailVerified: true,
        ownerProvider: "local",
      })
    ).toBe(true);
  });
});
