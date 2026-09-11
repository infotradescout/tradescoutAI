import { canonicalizeIssaBuildPublicUrl } from "../shared/issaBuildRoutes";
import { resolvePublicLandingIndexability } from "../shared/publicLandingIndexability";
import {
  EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME,
  getExchangeCategorySlugFromMarketplaceCategoryName,
} from "../shared/exchangeListingRules";

export const SITEMAP_URLSET_MAX_URLS = 50_000;

export type SitemapUrlSetEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

// These entries navigate elsewhere or require a signed-in application context;
// they are not standalone public search destinations. Their routes stay intact.
const NONCANONICAL_PUBLIC_ENTRIES = new Set(["/community", "/contact", "/maps"]);
const exchangeCategoryAliases = new Map<string, string>();
for (const [slug, name] of Object.entries(EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME)) {
  exchangeCategoryAliases.set(slug, slug);
  const canonical = getExchangeCategorySlugFromMarketplaceCategoryName(name) || "other";
  exchangeCategoryAliases.set(
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    canonical
  );
}

function compareSitemapEntries(left: SitemapUrlSetEntry, right: SitemapUrlSetEntry): number {
  const lastmodOrder = String(right.lastmod || "").localeCompare(String(left.lastmod || ""));
  if (lastmodOrder !== 0) return lastmodOrder;
  const locOrder = left.loc.localeCompare(right.loc);
  if (locOrder !== 0) return locOrder;
  const changefreqOrder = String(left.changefreq || "").localeCompare(String(right.changefreq || ""));
  if (changefreqOrder !== 0) return changefreqOrder;
  return String(left.priority || "").localeCompare(String(right.priority || ""));
}

function publicTradeScoutUrl(loc: string): URL | null {
  try {
    const url = new URL(loc);
    return ["http:", "https:"].includes(url.protocol) &&
      ["www.thetradescout.com", "thetradescout.com"].includes(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

function canonicalSitemapLocation(loc: string): string {
  const existing = canonicalizeIssaBuildPublicUrl(loc);
  const url = publicTradeScoutUrl(existing);
  if (!url) return existing;
  const listing = /^\/exchange\/([a-z0-9-]+)\/([^/]+)\/?$/.exec(url.pathname);
  if (!listing) return existing;
  // The listing renderer recognizes the shared categories and uses "other"
  // for unrecognized marketplace categories. Preserve the exact listing ID.
  const category = exchangeCategoryAliases.get(listing[1]) || "other";
  url.pathname = `/exchange/${category}/${listing[2]}`;
  return url.href;
}

function isIndexableLocation(loc: string): boolean {
  const url = publicTradeScoutUrl(loc);
  if (!url) return true;
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (NONCANONICAL_PUBLIC_ENTRIES.has(pathname)) return false;
  if (
    pathname !== "/" && pathname !== "/landing" && !pathname.startsWith("/landing/") &&
    pathname !== "/lp" && !pathname.startsWith("/lp/")
  ) return true;
  return resolvePublicLandingIndexability({ requestPath: url.pathname + url.search }).indexable;
}

/** Canonicalize and deduplicate before applying the sitemap protocol ceiling. */
export function prepareSitemapUrlSetEntries<T extends SitemapUrlSetEntry>(entries: readonly T[]): T[] {
  const sortedEntries = entries
    .filter((entry): entry is T => Boolean(entry && String(entry.loc || "").trim()))
    .map((entry) => {
      const loc = canonicalSitemapLocation(String(entry.loc).trim());
      return (loc === entry.loc ? entry : { ...entry, loc }) as T;
    })
    .filter((entry) => isIndexableLocation(entry.loc))
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
