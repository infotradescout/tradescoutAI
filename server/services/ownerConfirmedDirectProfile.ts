import {
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_STEWARD_PROVIDER,
} from "@shared/precisionAerialProfile";
import { isProfileVisibilityPublic as isSharedProfileVisibilityPublic } from "@shared/profileVisibility";
import {
  isSteelHomePackagesProfilePubliclyReleased,
  isSteelHomePackagesProfileSlug,
  STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE,
} from "@shared/steelHomePackagesProfile";

export const JRS_PROFILE_SLUG = "jrs-auto-glass";
export const OWNER_CONFIRMED_PROFILE_SOURCE = "owner_confirmed_profile";
export const PRO_FAB_PROFILE_SLUG = "pro-fab-specialty-services";
export const ADMIN_MANAGED_PROFILE_SOURCE = "admin_provisioned_business_profile";

const DIRECT_PROFILE_AUTHORITIES: Readonly<Record<string, string>> = {
  [JRS_PROFILE_SLUG]: OWNER_CONFIRMED_PROFILE_SOURCE,
  [PRO_FAB_PROFILE_SLUG]: ADMIN_MANAGED_PROFILE_SOURCE,
  [PRECISION_AERIAL_PROFILE_SLUG]: ADMIN_MANAGED_PROFILE_SOURCE,
};

export type OwnerConfirmedDirectProfileCandidate = {
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

export type LinkedBusinessProfileExposureCandidate = OwnerConfirmedDirectProfileCandidate & {
  businessId: unknown;
  ownerVerifiedBadge: unknown;
  ownerVerificationStatus: unknown;
};

export type PublishedProfileExposureCandidate = LinkedBusinessProfileExposureCandidate & {
  profileId: unknown;
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
 * The steel-home package page is intentionally reachable only by its exact
 * URL while its operator-approved content and ownership are being finalized.
 * A draft linked business prevents directory discovery; the published profile
 * state is solely the existing schema's renderability switch.
 */
export function isSteelHomePackagesUnlistedDirectProfile(
  candidate: OwnerConfirmedDirectProfileCandidate
): boolean {
  const profileOwnerUserId = String(candidate.profileOwnerUserId || "").trim();
  const businessOwnerUserId = String(candidate.businessOwnerUserId || "").trim();

  return (
    isSteelHomePackagesProfileSlug(candidate.profileSlug) &&
    !isSteelHomePackagesProfilePubliclyReleased() &&
    String(candidate.profileStatus || "")
      .trim()
      .toLowerCase() === "published" &&
    String(candidate.businessStatus || "")
      .trim()
      .toLowerCase() === "draft" &&
    candidate.publicDiscoveryEnabled === false &&
    profileOwnerUserId.length > 0 &&
    profileOwnerUserId === businessOwnerUserId &&
    Array.isArray(candidate.businessSources) &&
    candidate.businessSources.includes(STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE)
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
    profileSlug !== PRECISION_AERIAL_PROFILE_SLUG || hasExactPrecisionStewardAuthority(candidate);

  return hasProfileSpecificAuthority && hasBaseDirectProfileAuthority(candidate, requiredAuthority);
}

export function isPubliclyVerifiedProfileOwner(candidate: {
  ownerVerifiedBadge: unknown;
  ownerVerificationStatus: unknown;
}): boolean {
  const verificationStatus = String(candidate.ownerVerificationStatus || "")
    .trim()
    .toLowerCase();
  return candidate.ownerVerifiedBadge === true || verificationStatus === "approved";
}

/**
 * Canonical anonymous-read authority for a published, public-visibility
 * profile. Community/personal profiles without a business link keep their
 * existing public behavior. A linked business profile needs either the
 * owner's established verification signal or the exact, deliberately narrow
 * direct-profile authority above.
 */
export function canExposeLinkedBusinessProfilePublicly(
  candidate: LinkedBusinessProfileExposureCandidate
): boolean {
  if (!String(candidate.businessId || "").trim()) return true;
  return isPubliclyVerifiedProfileOwner(candidate) || isOwnerConfirmedDirectProfile(candidate);
}

export function isProfileVisibilityPublic(candidate: {
  profileId: unknown;
  ownerPreferences?: unknown;
}): boolean {
  return isSharedProfileVisibilityPublic({
    profileId: candidate.profileId,
    preferences: candidate.ownerPreferences,
  });
}

/** Complete anonymous exposure authority: exact profile visibility first,
 * then the linked-business verification/direct-profile trust gate. */
export function canExposePublishedProfilePublicly(
  candidate: PublishedProfileExposureCandidate
): boolean {
  if (
    String(candidate.profileStatus || "")
      .trim()
      .toLowerCase() !== "published"
  ) {
    return false;
  }
  if (
    isSteelHomePackagesProfileSlug(candidate.profileSlug) &&
    !isSteelHomePackagesProfilePubliclyReleased()
  ) {
    return false;
  }
  return isProfileVisibilityPublic(candidate) && canExposeLinkedBusinessProfilePublicly(candidate);
}

/**
 * Canonical read boundary for an exact profile URL. Normal profiles must pass
 * the full public-exposure gate. The operator-approved steel-home draft gets
 * one narrow unlisted exception so its URL and Direct Connect destination can
 * be reviewed without entering search, maps, sitemaps, or index metadata.
 */
export function canServePublishedProfileAtDirectRoute(
  candidate: PublishedProfileExposureCandidate
): boolean {
  return (
    isSteelHomePackagesUnlistedDirectProfile(candidate) ||
    canExposePublishedProfilePublicly(candidate)
  );
}

/**
 * A map marker labels its subject as a provider, so an unverified personal
 * profile is not enough authority even when that profile is intentionally
 * public. Provider discovery requires the complete public-profile boundary
 * plus either established owner verification or one of the exact managed
 * Direct Profile exceptions.
 */
export function canExposeProviderProfileOnPublicMap(
  candidate: PublishedProfileExposureCandidate
): boolean {
  return (
    canExposePublishedProfilePublicly(candidate) &&
    (isPubliclyVerifiedProfileOwner(candidate) || isOwnerConfirmedDirectProfile(candidate))
  );
}
