import type { County, Region } from "@shared/schema";

function normalizeLooseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bcounty\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCountyToken(countyCode?: string): string | undefined {
  if (!countyCode) return undefined;

  const raw = String(countyCode);
  const first = raw.split(",")[0]?.trim();
  if (!first) return undefined;

  const withoutPrefix = first.toLowerCase().startsWith("county:")
    ? first.slice("county:".length).trim()
    : first;

  return withoutPrefix || undefined;
}

export function extractCountyFips(countyCode?: string): string | undefined {
  const token = extractCountyToken(countyCode);
  if (!token) return undefined;
  return /^\d{5}$/.test(token) ? token : undefined;
}

export function resolveCountyFips(args: {
  countyCode?: string;
  stateCode?: string;
  counties?: Array<Pick<County, "name" | "fips" | "stateCode">>;
}): string | undefined {
  const direct = extractCountyFips(args.countyCode);
  if (direct) return direct;

  const token = extractCountyToken(args.countyCode);
  if (!token) return undefined;
  if (!args.stateCode) return undefined;

  const pool = (args.counties ?? []).filter((c) => c.stateCode === args.stateCode);
  if (pool.length === 0) return undefined;

  const needle = normalizeLooseText(token);
  if (!needle) return undefined;

  const exact = pool.find((c) => normalizeLooseText(c.name) === needle);
  if (exact) return exact.fips;

  const starts = pool.find((c) => normalizeLooseText(c.name).startsWith(needle));
  if (starts) return starts.fips;

  const includes = pool.find((c) => normalizeLooseText(c.name).includes(needle));
  if (includes) return includes.fips;

  return undefined;
}

export function resolveRegionSlug(args: {
  stateCode?: string;
  countyFips?: string;
  regions: Array<Pick<Region, "slug" | "statesCovered" | "countiesCovered" | "isOfficial">>;
}): string | undefined {
  const stateCode = args.stateCode;
  const countyFips = args.countyFips;

  const official = args.regions.filter((r) => r.isOfficial);
  const candidates = stateCode
    ? official.filter((r) => Array.isArray(r.statesCovered) && r.statesCovered.includes(stateCode))
    : official;

  if (countyFips) {
    const byCounty = candidates
      .filter((r) => Array.isArray(r.countiesCovered) && r.countiesCovered.includes(countyFips))
      .sort((a, b) => {
        const aSize = Array.isArray(a.countiesCovered) ? a.countiesCovered.length : Number.MAX_SAFE_INTEGER;
        const bSize = Array.isArray(b.countiesCovered) ? b.countiesCovered.length : Number.MAX_SAFE_INTEGER;
        if (aSize !== bSize) return aSize - bSize;
        return String(a.slug).localeCompare(String(b.slug));
      });

    if (byCounty.length > 0) return byCounty[0].slug;
  }

  // Explicit fallback rule (not “first match”): only use a statewide region
  // when it's marked official AND has no counties list.
  if (stateCode) {
    const statewide = candidates
      .filter((r) => r.slug && (!Array.isArray(r.countiesCovered) || r.countiesCovered.length === 0))
      .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));

    if (statewide.length > 0) return statewide[0].slug;
  }

  return undefined;
}
