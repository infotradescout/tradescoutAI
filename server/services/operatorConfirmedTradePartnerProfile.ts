import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
} from "@shared/mouldingMillworkProfile";
import { isProvisionedProfileAccountControlConfirmed } from "./provisionedProfileAccountControl";

export type OperatorConfirmedTradePartnerCandidate = {
  profileSlug: unknown;
  profileStatus: unknown;
  profileOwnerUserId: unknown;
  businessStatus: unknown;
  businessOwnerUserId: unknown;
  publicDiscoveryEnabled: unknown;
  businessSources: unknown;
  businessProfileData?: unknown;
  ownerVerificationStatus?: unknown;
  ownerEmailVerified?: unknown;
  ownerProvider?: unknown;
};

/**
 * Exact public-profile authority for an operator-confirmed TradePartner whose
 * account does not carry a public verification badge. This grants profile and
 * Direct Connect reachability only; it grants no badge, license, insurance,
 * map/provider-directory, Trust/CVS, or performance claim.
 */
export function isOperatorConfirmedTradePartnerProfile(
  candidate: OperatorConfirmedTradePartnerCandidate
): boolean {
  const profileSlug = String(candidate.profileSlug || "")
    .trim()
    .toLowerCase();
  const profileOwnerUserId = String(candidate.profileOwnerUserId || "").trim();
  const businessOwnerUserId = String(candidate.businessOwnerUserId || "").trim();
  const businessProfileData =
    candidate.businessProfileData &&
    typeof candidate.businessProfileData === "object" &&
    !Array.isArray(candidate.businessProfileData)
      ? (candidate.businessProfileData as Record<string, unknown>)
      : {};
  const ownerVerificationStatus = String(candidate.ownerVerificationStatus || "")
    .trim()
    .toLowerCase();

  return (
    profileSlug === MOULDING_MILLWORK_PROFILE_SLUG &&
    String(candidate.profileStatus || "")
      .trim()
      .toLowerCase() === "published" &&
    String(candidate.businessStatus || "")
      .trim()
      .toLowerCase() === "active" &&
    candidate.publicDiscoveryEnabled === true &&
    businessProfileData.tradePartner === true &&
    !["rejected", "expired", "suspended"].includes(ownerVerificationStatus) &&
    isProvisionedProfileAccountControlConfirmed({
      emailVerified: candidate.ownerEmailVerified,
      provider: candidate.ownerProvider,
      verificationStatus: candidate.ownerVerificationStatus,
    }) &&
    profileOwnerUserId.length > 0 &&
    profileOwnerUserId === businessOwnerUserId &&
    Array.isArray(candidate.businessSources) &&
    candidate.businessSources.includes(MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE) &&
    !candidate.businessSources.includes(MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE)
  );
}
