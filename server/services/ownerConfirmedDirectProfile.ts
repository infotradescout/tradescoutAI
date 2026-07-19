export const JRS_PROFILE_SLUG = "jrs-auto-glass";
export const OWNER_CONFIRMED_PROFILE_SOURCE = "owner_confirmed_profile";
export const PRO_FAB_PROFILE_SLUG = "pro-fab-specialty-services";
export const ADMIN_MANAGED_PROFILE_SOURCE = "admin_provisioned_business_profile";

const DIRECT_PROFILE_AUTHORITIES: Readonly<Record<string, string>> = {
  [JRS_PROFILE_SLUG]: OWNER_CONFIRMED_PROFILE_SOURCE,
  [PRO_FAB_PROFILE_SLUG]: ADMIN_MANAGED_PROFILE_SOURCE,
};

type OwnerConfirmedDirectProfileCandidate = {
  profileSlug: unknown;
  profileStatus: unknown;
  profileOwnerUserId: unknown;
  businessStatus: unknown;
  businessOwnerUserId: unknown;
  publicDiscoveryEnabled: unknown;
  businessSources: unknown;
};

/**
 * Direct profiles are deliberately narrow exceptions to general directory
 * exposure. A profile may be viewed and contacted only while its published
 * profile, active business, owner, and explicit provisioning authority remain
 * in agreement. The exception authorizes a Direct Connect destination; it is
 * not evidence of identity, license, insurance, or TradeScout verification.
 */
export function isOwnerConfirmedDirectProfile(
  candidate: OwnerConfirmedDirectProfileCandidate
): boolean {
  const profileSlug = String(candidate.profileSlug || "")
    .trim()
    .toLowerCase();
  const profileOwnerUserId = String(candidate.profileOwnerUserId || "").trim();
  const businessOwnerUserId = String(candidate.businessOwnerUserId || "").trim();
  const requiredAuthority = DIRECT_PROFILE_AUTHORITIES[profileSlug];

  return (
    Boolean(requiredAuthority) &&
    String(candidate.profileStatus || "")
      .trim()
      .toLowerCase() === "published" &&
    String(candidate.businessStatus || "")
      .trim()
      .toLowerCase() === "active" &&
    candidate.publicDiscoveryEnabled === false &&
    profileOwnerUserId.length > 0 &&
    profileOwnerUserId === businessOwnerUserId &&
    Array.isArray(candidate.businessSources) &&
    candidate.businessSources.includes(requiredAuthority)
  );
}
