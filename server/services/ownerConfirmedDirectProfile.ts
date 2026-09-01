import {
  PRECISION_AERIAL_PROFILE_SLUG,
  PRECISION_AERIAL_STEWARD_PROVIDER,
} from "@shared/precisionAerialProfile";
import {
  ADMIN_MANAGED_PROFILE_SOURCE,
  getDirectProfileAuthority,
  isInternalAdminProfileSlug,
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
  PRO_FAB_PROFILE_SLUG,
} from "@shared/publicProfileExposureRegistry";
import {
  isSteelHomePackagesProfilePubliclyReleased,
  isSteelHomePackagesProfileSlug,
  STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE,
} from "@shared/steelHomePackagesProfile";
import { isProfessionalProfileRoleContext } from "./profileTargetAuthority";
import { isOperatorConfirmedTradePartnerProfile } from "./operatorConfirmedTradePartnerProfile";

export {
  ADMIN_MANAGED_PROFILE_SOURCE,
  JRS_PROFILE_SLUG,
  OWNER_CONFIRMED_PROFILE_SOURCE,
  PRO_FAB_PROFILE_SLUG,
} from "@shared/publicProfileExposureRegistry";

const INTERNAL_PROFILE_ROLES = new Set([
  "admin",
  "analytics_specialist",
  "content_seo",
  "head_admin",
  "marketing_specialist",
  "moderator",
  "ops_admin",
  "super_admin",
]);

const PUBLIC_PERSONAL_PROFILE_ROLES = new Set([
  "community_builder",
  "content_creator",
  "hoa_board",
  "hoa_member",
  "homeowner",
  "landlord",
  "nonprofit_org",
  "property_manager",
  "renter",
]);

const NON_CONTENT_PROFILE_BLOCK_TYPES = new Set([
  "profilepresentation",
  "profilesections",
  "sitetemplate",
]);

export type OwnerConfirmedDirectProfileCandidate = {
  profileSlug: unknown;
  profileStatus: unknown;
  profileOwnerUserId: unknown;
  businessStatus: unknown;
  businessOwnerUserId: unknown;
  publicDiscoveryEnabled: unknown;
  businessSources: unknown;
  businessClaimStatus?: unknown;
  businessProfileData?: unknown;
  profileRoleContext?: unknown;
  profileHeadline?: unknown;
  profileServicesDescription?: unknown;
  profileContentBlocks?: unknown;
  ownerRole?: unknown;
  ownerRoles?: unknown;
  ownerVerifiedBadge?: unknown;
  ownerVerificationStatus?: unknown;
  ownerProvider?: unknown;
  ownerEmailVerified?: unknown;
  ownerPreferences?: unknown;
  professionalRoleApproved?: unknown;
};

export type LinkedBusinessProfileExposureCandidate = OwnerConfirmedDirectProfileCandidate & {
  businessId: unknown;
  ownerVerifiedBadge: unknown;
  ownerVerificationStatus: unknown;
};

export type PublishedProfileExposureCandidate = LinkedBusinessProfileExposureCandidate & {
  profileId: unknown;
  profilePubliclyReleased: unknown;
};

export type PublicProfileExposureMode = "private" | "direct_only" | "unlisted_review" | "public";
export type PublicProfileExposureReason =
  | "business_trust_missing"
  | "business_ownership_mismatch"
  | "direct_only"
  | "empty_profile"
  | "internal_role"
  | "personal_profile_not_explicitly_released"
  | "professional_approval_missing"
  | "private"
  | "public"
  | "unlisted_review"
  | "unpublished";
export type PublicProfileExposureDecision = {
  mode: PublicProfileExposureMode;
  reason: PublicProfileExposureReason;
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function ownerRoles(candidate: { ownerRole?: unknown; ownerRoles?: unknown }): string[] {
  return [
    normalizeRole(candidate.ownerRole),
    ...(Array.isArray(candidate.ownerRoles) ? candidate.ownerRoles.map(normalizeRole) : []),
  ].filter(Boolean);
}

function hasMeaningfulValue(value: unknown, depth = 0): boolean {
  if (depth > 5 || value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return false;
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item, depth + 1));
  if (typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some((item) =>
    hasMeaningfulValue(item, depth + 1)
  );
}

export function hasMeaningfulPublicProfileContent(
  candidate: Pick<
    OwnerConfirmedDirectProfileCandidate,
    "profileHeadline" | "profileServicesDescription" | "profileContentBlocks"
  >
): boolean {
  if (String(candidate.profileHeadline || "").trim()) return true;
  if (String(candidate.profileServicesDescription || "").trim()) return true;
  if (!Array.isArray(candidate.profileContentBlocks)) return false;

  return candidate.profileContentBlocks.some((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return false;
    const source = block as Record<string, unknown>;
    const type = String(source.type || "")
      .trim()
      .toLowerCase();
    return (
      Boolean(type) && !NON_CONTENT_PROFILE_BLOCK_TYPES.has(type) && hasMeaningfulValue(source.data)
    );
  });
}

function hasInternalProfileIdentity(candidate: PublishedProfileExposureCandidate): boolean {
  if (isInternalAdminProfileSlug(candidate.profileSlug)) return true;
  if (INTERNAL_PROFILE_ROLES.has(normalizeRole(candidate.profileRoleContext))) return true;
  return (
    !String(candidate.businessId || "").trim() &&
    ownerRoles(candidate).some((role) => INTERNAL_PROFILE_ROLES.has(role))
  );
}

export function hasVerifiedTradeScoutAdminCustody(candidate: {
  ownerRole?: unknown;
  ownerRoles?: unknown;
  ownerVerifiedBadge?: unknown;
  ownerVerificationStatus?: unknown;
}): boolean {
  return (
    ownerRoles(candidate).some((role) => role === "super_admin" || role === "head_admin") &&
    isPubliclyVerifiedProfileOwner(candidate)
  );
}

function hasExactPrecisionStewardAuthority(
  candidate: OwnerConfirmedDirectProfileCandidate
): boolean {
  const marker = recordValue(recordValue(candidate.ownerPreferences).internalProfileSteward);
  return (
    String(candidate.businessClaimStatus || "")
      .trim()
      .toLowerCase() === "unclaimed" &&
    String(candidate.ownerProvider || "") === PRECISION_AERIAL_STEWARD_PROVIDER &&
    String(marker.profileSlug || "") === PRECISION_AERIAL_PROFILE_SLUG &&
    String(marker.source || "") === ADMIN_MANAGED_PROFILE_SOURCE
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

export function hasTradeScoutPendingOwnerCustody(
  candidate: OwnerConfirmedDirectProfileCandidate
): boolean {
  const slug = String(candidate.profileSlug || "")
    .trim()
    .toLowerCase();
  return (
    slug === PRECISION_AERIAL_PROFILE_SLUG &&
    hasBaseDirectProfileAuthority(candidate, ADMIN_MANAGED_PROFILE_SOURCE) &&
    hasExactPrecisionStewardAuthority(candidate)
  );
}

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
    hasVerifiedTradeScoutAdminCustody(candidate) &&
    profileOwnerUserId.length > 0 &&
    profileOwnerUserId === businessOwnerUserId &&
    Array.isArray(candidate.businessSources) &&
    candidate.businessSources.includes(STEEL_HOME_PACKAGES_PROFILE_PROVISIONING_SOURCE)
  );
}

export function isOwnerConfirmedDirectProfile(
  candidate: OwnerConfirmedDirectProfileCandidate
): boolean {
  const slug = String(candidate.profileSlug || "")
    .trim()
    .toLowerCase();
  const requiredAuthority = getDirectProfileAuthority(slug);
  if (!requiredAuthority) return false;
  if (slug === PRECISION_AERIAL_PROFILE_SLUG && !hasExactPrecisionStewardAuthority(candidate)) {
    return false;
  }
  return hasBaseDirectProfileAuthority(candidate, requiredAuthority);
}

export function isPubliclyVerifiedProfileOwner(candidate: {
  ownerVerifiedBadge?: unknown;
  ownerVerificationStatus?: unknown;
}): boolean {
  return (
    candidate.ownerVerifiedBadge === true ||
    String(candidate.ownerVerificationStatus || "")
      .trim()
      .toLowerCase() === "approved"
  );
}

/** Trust-only helper. Route, discovery, and indexing decisions are stricter. */
export function canExposeLinkedBusinessProfilePublicly(
  candidate: LinkedBusinessProfileExposureCandidate
): boolean {
  return (
    Boolean(String(candidate.businessId || "").trim()) &&
    (isPubliclyVerifiedProfileOwner(candidate) || isOwnerConfirmedDirectProfile(candidate))
  );
}

export function isProfileVisibilityPublic(candidate: {
  profilePubliclyReleased?: unknown;
}): boolean {
  return candidate.profilePubliclyReleased === true;
}

/** Canonical exposure decision for every anonymous public-profile surface. */
export function derivePublishedProfileExposure(
  candidate: PublishedProfileExposureCandidate
): PublicProfileExposureDecision {
  if (
    String(candidate.profileStatus || "")
      .trim()
      .toLowerCase() !== "published"
  ) {
    return { mode: "private", reason: "unpublished" };
  }

  const businessId = String(candidate.businessId || "").trim();
  if (!isProfileVisibilityPublic(candidate)) {
    return {
      mode: "private",
      reason: businessId ? "private" : "personal_profile_not_explicitly_released",
    };
  }

  if (isSteelHomePackagesUnlistedDirectProfile(candidate)) {
    return { mode: "unlisted_review", reason: "unlisted_review" };
  }

  if (hasInternalProfileIdentity(candidate)) {
    return { mode: "private", reason: "internal_role" };
  }

  const professionalRole = isProfessionalProfileRoleContext(candidate.profileRoleContext);
  if (professionalRole && candidate.professionalRoleApproved !== true) {
    return { mode: "private", reason: "professional_approval_missing" };
  }

  if (businessId) {
    const profileOwnerUserId = String(candidate.profileOwnerUserId || "").trim();
    const businessOwnerUserId = String(candidate.businessOwnerUserId || "").trim();
    if (!profileOwnerUserId || profileOwnerUserId !== businessOwnerUserId) {
      return { mode: "private", reason: "business_ownership_mismatch" };
    }
    if (
      String(candidate.businessStatus || "")
        .trim()
        .toLowerCase() !== "active"
    ) {
      return { mode: "private", reason: "business_trust_missing" };
    }
    if (isOperatorConfirmedTradePartnerProfile(candidate)) {
      return { mode: "public", reason: "public" };
    }
    if (isOwnerConfirmedDirectProfile(candidate)) {
      return { mode: "direct_only", reason: "direct_only" };
    }
    if (!isPubliclyVerifiedProfileOwner(candidate)) {
      return { mode: "private", reason: "business_trust_missing" };
    }
    if (candidate.publicDiscoveryEnabled === true) {
      return { mode: "public", reason: "public" };
    }
    if (candidate.publicDiscoveryEnabled === false) {
      return { mode: "direct_only", reason: "direct_only" };
    }
    return { mode: "private", reason: "business_trust_missing" };
  }

  if (professionalRole) {
    return hasMeaningfulPublicProfileContent(candidate)
      ? { mode: "public", reason: "public" }
      : { mode: "private", reason: "empty_profile" };
  }

  if (!PUBLIC_PERSONAL_PROFILE_ROLES.has(normalizeRole(candidate.profileRoleContext))) {
    return { mode: "private", reason: "private" };
  }
  if (!hasMeaningfulPublicProfileContent(candidate)) {
    return { mode: "private", reason: "empty_profile" };
  }
  return { mode: "public", reason: "public" };
}

/**
 * Compatibility for existing profile/contact readers. Exact registered direct
 * profiles remain reachable, while generic direct-only profiles do not become
 * discovery or indexing candidates through this helper.
 */
export function canExposePublishedProfilePublicly(
  candidate: PublishedProfileExposureCandidate
): boolean {
  const decision = derivePublishedProfileExposure(candidate);
  return (
    decision.mode === "public" ||
    (decision.mode === "direct_only" && isOwnerConfirmedDirectProfile(candidate))
  );
}

export function canDiscoverPublishedProfilePublicly(
  candidate: PublishedProfileExposureCandidate
): boolean {
  return derivePublishedProfileExposure(candidate).mode === "public";
}

export function canServePublishedProfileAtDirectRoute(
  candidate: PublishedProfileExposureCandidate
): boolean {
  return derivePublishedProfileExposure(candidate).mode !== "private";
}

export function canExposeProviderProfileOnPublicMap(
  candidate: PublishedProfileExposureCandidate
): boolean {
  return (
    canDiscoverPublishedProfilePublicly(candidate) && isPubliclyVerifiedProfileOwner(candidate)
  );
}
