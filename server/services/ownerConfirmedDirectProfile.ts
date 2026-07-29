import {
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_STEWARD_PROVIDER,
} from "@shared/precisionAerialProfile";

export const JRS_PROFILE_SLUG = "jrs-auto-glass";
export const OWNER_CONFIRMED_PROFILE_SOURCE = "owner_confirmed_profile";
export const PRO_FAB_PROFILE_SLUG = "pro-fab-specialty-services";
export const ADMIN_MANAGED_PROFILE_SOURCE = "admin_provisioned_business_profile";

const DIRECT_PROFILE_AUTHORITIES: Readonly<Record<string, string>> = {
  [JRS_PROFILE_SLUG]: OWNER_CONFIRMED_PROFILE_SOURCE,
  [PRO_FAB_PROFILE_SLUG]: ADMIN_MANAGED_PROFILE_SOURCE,
  [PRECISION_AERIAL_PROFILE_SLUG]: ADMIN_MANAGED_PROFILE_SOURCE,
};

type OwnerConfirmedDirectProfileCandidate = {
  profileSlug: unknown;
  profileStatus: unknown;
  profileOwnerUserId: unknown;
  businessStatus: unknown;
  businessOwnerUserId: unknown;
  publicDiscoveryEnabled: unknown;
  businessSources: unknown;
  businessClaimStatus?: unknown;
  ownerProvider?: unknown;
  ownerPreferences?: unknown;
};

function recordValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function hasExactPrecisionStewardAuthority(
  candidate: OwnerConfirmedDirectProfileCandidate
): boolean {
  const preferences = recordValue(candidate.ownerPreferences);
  const marker = recordValue(preferences.internalProfileSteward);

  return (
    String(candidate.businessClaimStatus || "")
      .trim()
      .toLowerCase() === "unclaimed" &&
    String(candidate.ownerProvider || "") === PRECISION_AERIAL_STEWARD_PROVIDER &&
    String(marker.profileSlug || "") === PRECISION_AERIAL_PROFILE_SLUG &&
    String(marker.source || "") === ADMIN_MANAGED_PROFILE_SOURCE
  );
}

export function hasTradeScoutPendingOwnerCustody(
  candidate: OwnerConfirmedDirectProfileCandidate
): boolean {
  const profileSlug = String(candidate.profileSlug || "")
    .trim()
    .toLowerCase();
  return (
    profileSlug === PRECISION_AERIAL_PROFILE_SLUG &&
    hasBaseDirectProfileAuthority(candidate, ADMIN_MANAGED_PROFILE_SOURCE) &&
    hasExactPrecisionStewardAuthority(candidate)
  );
}

function hasBaseDirectProfileAuthority(
  candidate: OwnerConfirmedDirectProfileCandidate,
  requiredAuthority: string
): boolean {
  const profileOwnerUserId = String(candidate.profileOwnerUserId || "").trim();
  const businessOwnerUserId = String(candidate.businessOwnerUserId || "").trim();

  return (
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
  const requiredAuthority = DIRECT_PROFILE_AUTHORITIES[profileSlug];
  if (!requiredAuthority) return false;
  const hasProfileSpecificAuthority =
    profileSlug !== PRECISION_AERIAL_PROFILE_SLUG ||
    hasExactPrecisionStewardAuthority(candidate);

  return (
    hasProfileSpecificAuthority &&
    hasBaseDirectProfileAuthority(candidate, requiredAuthority)
  );
}
