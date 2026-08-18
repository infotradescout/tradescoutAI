import {
  INTERNAL_ADMIN_PROFILE_SLUGS,
  isInternalAdminProfileSlug,
  isRegisteredDirectProfileSlug,
} from "./publicProfileExposureRegistry";
import {
  isSteelHomePackagesProfilePubliclyReleased,
  isSteelHomePackagesProfileSlug,
} from "./steelHomePackagesProfile";

export { INTERNAL_ADMIN_PROFILE_SLUGS, isInternalAdminProfileSlug };

/**
 * Indexing can only narrow an already-public route. Internal profiles,
 * direct-link profiles, and unreleased review surfaces never enter search or
 * profile sitemaps.
 */
export function shouldIndexPublicProfileSlug(slug: unknown): boolean {
  if (isInternalAdminProfileSlug(slug)) return false;
  if (isRegisteredDirectProfileSlug(slug)) return false;
  if (isSteelHomePackagesProfileSlug(slug) && !isSteelHomePackagesProfilePubliclyReleased()) {
    return false;
  }
  return true;
}
