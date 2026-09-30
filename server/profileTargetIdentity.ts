import type { Profile } from "@shared/schema";
import {
  normalizeProfileCustomDomain,
  profileTargetIdentitiesEqual,
  type ProfileTargetIdentity,
} from "@shared/profileTargetIdentity";

export function profileTargetIdentityFromRow(profile: Profile): ProfileTargetIdentity {
  const seoMeta = profile.seoMeta && typeof profile.seoMeta === "object"
    ? profile.seoMeta as Record<string, unknown> : {};
  return {
    ownerUserId: profile.ownerUserId,
    businessId: profile.businessId,
    roleContext: profile.roleContext,
    slug: profile.slug,
    status: profile.status,
    publiclyReleased: profile.publiclyReleased,
    customDomain: normalizeProfileCustomDomain(seoMeta.customDomain),
  };
}

export function profileTargetIdentityMatches(
  expected: ProfileTargetIdentity,
  profile: Profile
): boolean {
  return profileTargetIdentitiesEqual(expected, profileTargetIdentityFromRow(profile));
}
