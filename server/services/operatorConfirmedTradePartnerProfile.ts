import {
  MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE,
  MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE,
  MOULDING_MILLWORK_PROFILE_SLUG,
} from "@shared/mouldingMillworkProfile";
import { isProvisionedProfileAccountControlConfirmed } from "./provisionedProfileAccountControl";

type OperatorConfirmedTradePartnerCandidate = {
  profileSlug: unknown;
  profileStatus: unknown;
  profileOwnerUserId: unknown;
  businessStatus: unknown;
  businessOwnerUserId: unknown;
  publicDiscoveryEnabled: unknown;
  businessSources: unknown;
  businessProfileData: unknown;
  ownerProfileVisibility: unknown;
  ownerVerificationStatus: unknown;
  ownerEmailVerified: unknown;
  ownerProvider: unknown;
};

/**
 * Allows a narrowly identified, operator-confirmed TradePartner profile to be
 * viewed and contacted without asserting that its account owner is verified.
 * This is profile/Direct Connect authority only; it does not authorize
 * verification badges, Trust/CVS state, or commercial catalog exposure.
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
  const ownerAccountControlConfirmed = isProvisionedProfileAccountControlConfirmed({
    emailVerified: candidate.ownerEmailVerified,
    provider: candidate.ownerProvider,
    verificationStatus: candidate.ownerVerificationStatus,
  });

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
    String(candidate.ownerProfileVisibility || "")
      .trim()
      .toLowerCase() === "public" &&
    !["rejected", "expired", "suspended"].includes(ownerVerificationStatus) &&
    ownerAccountControlConfirmed &&
    profileOwnerUserId.length > 0 &&
    profileOwnerUserId === businessOwnerUserId &&
    Array.isArray(candidate.businessSources) &&
    candidate.businessSources.includes(MOULDING_MILLWORK_PROFILE_AUTHORITY_SOURCE) &&
    !candidate.businessSources.includes(MOULDING_MILLWORK_PROFILE_REVOKED_SOURCE)
  );
}
