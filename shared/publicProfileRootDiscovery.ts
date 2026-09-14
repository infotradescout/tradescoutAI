import { ISSA_BUILD_PROFILE_SLUG } from "./issaBuildProfile";

/**
 * Resolve an existing platform profile root, not a general vanity route.
 * This is only a route identity hint: callers must still load the public
 * profile through the existing authority checks before exposing any links.
 * Child service URLs remain in their established /u/:slug namespace.
 */
export function resolvePublicProfileRootDiscoverySlug(pathname: unknown): string | null {
  if (typeof pathname !== "string") return null;
  const root = pathname.replace(/\/+$/, "") || "/";
  if (root.toLowerCase() === `/${ISSA_BUILD_PROFILE_SLUG}`) {
    return ISSA_BUILD_PROFILE_SLUG;
  }
  const match = root.match(/^\/u\/([^/]+)$/i);
  if (!match) return null;
  try {
    const slug = decodeURIComponent(match[1]).trim().toLowerCase();
    return slug && slug.length <= 160 && !/[\s/\\?#%\u0000-\u001f\u007f]/.test(slug)
      ? slug
      : null;
  } catch {
    return null;
  }
}
