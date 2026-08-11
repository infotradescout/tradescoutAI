import {
  isSteelHomePackagesProfilePubliclyReleased,
  isSteelHomePackagesProfileSlug,
} from "./steelHomePackagesProfile";

export const INTERNAL_ADMIN_PROFILE_SLUGS = ["tradescout-admin", "super-admin"] as const;

const internalAdminProfileSlugs = new Set<string>(INTERNAL_ADMIN_PROFILE_SLUGS);

export function isInternalAdminProfileSlug(slug: unknown): boolean {
  return internalAdminProfileSlugs.has(
    String(slug || "")
      .trim()
      .toLowerCase()
  );
}

export function shouldIndexPublicProfileSlug(slug: unknown): boolean {
  if (isInternalAdminProfileSlug(slug)) return false;
  if (isSteelHomePackagesProfileSlug(slug) && !isSteelHomePackagesProfilePubliclyReleased()) {
    return false;
  }
  return true;
}
