import { PRECISION_AERIAL_PROFILE_SLUG } from "./precisionAerialProfile";

export const JRS_PROFILE_SLUG = "jrs-auto-glass";
export const OWNER_CONFIRMED_PROFILE_SOURCE = "owner_confirmed_profile";
export const PRO_FAB_PROFILE_SLUG = "pro-fab-specialty-services";
export const ADMIN_MANAGED_PROFILE_SOURCE = "admin_provisioned_business_profile";

/**
 * Existing exact direct-profile authorities. These profiles can be reached by
 * their deliberate URL while the matching custody evidence remains valid, but
 * they are not general directory, map, sitemap, or search-index candidates.
 */
export const DIRECT_PROFILE_AUTHORITIES: Readonly<Record<string, string>> = Object.freeze({
  [JRS_PROFILE_SLUG]: OWNER_CONFIRMED_PROFILE_SOURCE,
  [PRO_FAB_PROFILE_SLUG]: ADMIN_MANAGED_PROFILE_SOURCE,
  [PRECISION_AERIAL_PROFILE_SLUG]: ADMIN_MANAGED_PROFILE_SOURCE,
});

export const INTERNAL_ADMIN_PROFILE_SLUGS = ["tradescout-admin", "super-admin"] as const;

const internalAdminProfileSlugs = new Set<string>(INTERNAL_ADMIN_PROFILE_SLUGS);

function normalizeProfileSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function getDirectProfileAuthority(slug: unknown): string | null {
  return DIRECT_PROFILE_AUTHORITIES[normalizeProfileSlug(slug)] || null;
}

export function isRegisteredDirectProfileSlug(slug: unknown): boolean {
  return Boolean(getDirectProfileAuthority(slug));
}

export function isInternalAdminProfileSlug(slug: unknown): boolean {
  return internalAdminProfileSlugs.has(normalizeProfileSlug(slug));
}
