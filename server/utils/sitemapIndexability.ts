/**
 * Phase C/E sitemap URL invariants — every emitted loc must be index-eligible at emit time.
 */

export type SitemapUrlEntry = {
  loc: string;
  lastmod: string;
  changefreq?: string;
  priority?: string;
};

/** Reject corrupted city slugs from directory sitemaps (e.g. leading hyphen from bad pipeline data). */
export function isValidDirectoryCitySlug(citySlug: string): boolean {
  const normalized = String(citySlug || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith("-")) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized);
}

/** Gate trade/county/city/best sitemap rows on qualifying public directory listings. */
export function hasQualifyingDirectoryListings(listingCount: number): boolean {
  return Number.isFinite(listingCount) && listingCount > 0;
}

export function assertSitemapUrlIsIndexEligible(
  entry: SitemapUrlEntry | null | undefined
): entry is SitemapUrlEntry {
  if (!entry || typeof entry !== "object") return false;
  const loc = String(entry.loc || "").trim();
  const lastmod = String(entry.lastmod || "").trim();
  if (!loc || !lastmod) return false;
  if (!/^https?:\/\//i.test(loc)) return false;
  if (/\s/.test(loc)) return false;
  return true;
}

/** Drop URLs that would resolve to terminal public-page responses (404/500/noindex shells). */
export function excludeTerminalPublicPageUrls<T extends SitemapUrlEntry>(
  entries: Array<T | null | undefined>
): T[] {
  return entries.filter((entry): entry is T => assertSitemapUrlIsIndexEligible(entry));
}

/** Keep only homescout listing ids that remain active/renderable at sitemap emit time. */
export function excludeNonRenderableHomeScoutListings<
  T extends { id: string; updatedAt?: Date | null },
>(listings: T[]): T[] {
  return listings.filter((listing) => String(listing?.id || "").trim().length > 0);
}

const ADMIN_TIER_ROLES = new Set(["admin", "super_admin", "ops_admin", "head_admin", "owner"]);

export function isIndexablePublishedProfile(args: {
  profileSlug: string;
  role?: string | null;
  roles?: string[] | null;
}): boolean {
  const slug = String(args.profileSlug || "")
    .trim()
    .toLowerCase();
  if (!slug) return false;
  if (slug === "super-admin" || slug.endsWith("-admin")) return false;

  const primaryRole = String(args.role || "")
    .trim()
    .toLowerCase();
  if (ADMIN_TIER_ROLES.has(primaryRole)) return false;

  const roleList = Array.isArray(args.roles) ? args.roles : [];
  for (const role of roleList) {
    if (
      ADMIN_TIER_ROLES.has(
        String(role || "")
          .trim()
          .toLowerCase()
      )
    )
      return false;
  }

  return true;
}

/** Exclude admin/staff/test profiles from sitemap-u-profiles emitters (admin_flag contract). */
export function excludeNonIndexableProfileSitemapTargets<
  T extends {
    profileSlug: string;
    role?: string | null;
    roles?: string[] | null;
  },
>(targets: T[]): T[] {
  return targets.filter((target) =>
    isIndexablePublishedProfile({
      profileSlug: target.profileSlug,
      role: target.role ?? null,
      roles: target.roles ?? [],
    })
  );
}
