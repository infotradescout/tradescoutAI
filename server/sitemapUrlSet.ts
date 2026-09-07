import { canonicalizeIssaBuildPublicUrl } from "../shared/issaBuildRoutes";

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
