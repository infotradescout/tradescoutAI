export const JRS_PROFILE_SLUG = "jrs-auto-glass";
export const OWNER_CONFIRMED_PROFILE_SOURCE = "owner_confirmed_profile";

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
 * JR's is a deliberately narrow, owner-confirmed direct profile. It may be
 * viewed and contacted without granting the owner general directory exposure,
 * but only while the published profile and active business still agree on the
 * same owner and retain the provisioning authority marker.
 */
export function isOwnerConfirmedDirectProfile(
  candidate: OwnerConfirmedDirectProfileCandidate
): boolean {
  const profileOwnerUserId = String(candidate.profileOwnerUserId || "").trim();
  const businessOwnerUserId = String(candidate.businessOwnerUserId || "").trim();

  return (
    String(candidate.profileSlug || "")
      .trim()
      .toLowerCase() === JRS_PROFILE_SLUG &&
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
    candidate.businessSources.includes(OWNER_CONFIRMED_PROFILE_SOURCE)
  );
}
