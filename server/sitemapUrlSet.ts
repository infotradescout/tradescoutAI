import { canonicalizeIssaBuildPublicUrl } from "../shared/issaBuildRoutes";
import { resolvePublicLandingIndexability } from "../shared/publicLandingIndexability";

export const SITEMAP_URLSET_MAX_URLS = 50_000;

export type SitemapUrlSetEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

function compareSitemapEntries(left: SitemapUrlSetEntry, right: SitemapUrlSetEntry): number {
  const lastmodOrder = String(right.lastmod || "").localeCompare(String(left.lastmod || ""));
  if (lastmodOrder !== 0) return lastmodOrder;

  const locOrder = left.loc.localeCompare(right.loc);
  if (locOrder !== 0) return locOrder;

  const changefreqOrder = String(left.changefreq || "").localeCompare(
    String(right.changefreq || "")
  );
  if (changefreqOrder !== 0) return changefreqOrder;

  return String(left.priority || "").localeCompare(String(right.priority || ""));
}

function isIndexableLandingLocation(loc: string): boolean {
  let url: URL;
  try {
    url = new URL(loc);
  } catch {
    // Preserve existing handling of non-absolute entries; this filter only
    // owns TradeScout landing pages, not general URL validation.
    return true;
  }
  if (url.hostname !== "www.thetradescout.com" && url.hostname !== "thetradescout.com") {
    return true;
  }
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (
    pathname !== "/" &&
    pathname !== "/landing" &&
    !pathname.startsWith("/landing/") &&
    pathname !== "/lp" &&
    !pathname.startsWith("/lp/")
  ) {
    return true;
  }
  // Use the same decision as the rendered page. Do not submit noindex aliases
  // or campaign variants, and do not change their public routing or content.
  return resolvePublicLandingIndexability({
    requestPath: url.pathname + url.search,
  }).indexable;
}

/**
 * Produces a deterministic, protocol-safe URL set. Newer entries win the
 * ceiling, canonical locations break ties, and duplicate locations collapse
 * before the 50,000-URL sitemap protocol limit is applied.
 */
export function prepareSitemapUrlSetEntries<T extends SitemapUrlSetEntry>(
  entries: readonly T[]
): T[] {
  const sortedEntries = entries
    .filter((entry): entry is T => Boolean(entry && String(entry.loc || "").trim()))
    .map((entry) => {
      const loc = canonicalizeIssaBuildPublicUrl(String(entry.loc).trim());
      return (loc === entry.loc ? entry : { ...entry, loc }) as T;
    })
    .filter((entry) => isIndexableLandingLocation(entry.loc))
    .sort(compareSitemapEntries);

  const prepared: T[] = [];
  const seenLocations = new Set<string>();

  for (const entry of sortedEntries) {
    if (seenLocations.has(entry.loc)) continue;
    seenLocations.add(entry.loc);
    prepared.push(entry);
    if (prepared.length === SITEMAP_URLSET_MAX_URLS) break;
  }

  return prepared;
}
