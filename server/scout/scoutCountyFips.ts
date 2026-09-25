import { US_STATES_COUNTIES } from "../../shared/states-counties";
import { COMPREHENSIVE_TRADES } from "../../shared/trades-data";

/** A county label is display text, never a database county key. */
export function normalizeScoutCountyFips(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim();
    if (/^\d{5}$/.test(value)) return value;
  }
  return null;
}

type ScoutCountyIdentity = {
  fips: string;
  name: string;
  stateCode: string;
  label: string;
};

const COUNTIES: ScoutCountyIdentity[] = US_STATES_COUNTIES.flatMap((state) =>
  state.counties.map((county) => ({
    fips: county.fipsCode,
    name: county.name,
    stateCode: state.code,
    label: `${county.name}, ${state.code}`,
  }))
);
const COUNTY_BY_FIPS = new Map(COUNTIES.map((county) => [county.fips, county]));

function normalizedCountyName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+county$/, "")
    .replace(/\s+/g, " ");
}

function matchesCountyLabel(value: string, county: ScoutCountyIdentity): boolean {
  const parts = value
    .trim()
    .split(",")
    .map((part) => part.trim());
  if (parts.length > 2 || !parts[0]) return false;
  if (parts.length === 2 && parts[1].toUpperCase() !== county.stateCode) return false;
  return normalizedCountyName(parts[0]) === normalizedCountyName(county.name);
}

/**
 * Resolve one county identity before a local result is queried or named.
 * An explicit area must never silently fall back to an older profile county.
 */
export function resolveScoutCountyDiscoveryArea(input: {
  countyHint?: unknown;
  countyCode?: unknown;
  stateCode?: unknown;
  profileCountyFips?: unknown;
  profileCountyFipsAlt?: unknown;
}): { countyFips: string | null; countyLabel: string | undefined } {
  const noCounty = { countyFips: null, countyLabel: undefined };
  const hint = typeof input.countyHint === "string" ? input.countyHint.trim() : "";
  const code = typeof input.countyCode === "string" ? input.countyCode.trim() : "";
  const state = typeof input.stateCode === "string" ? input.stateCode.trim().toUpperCase() : "";
  const explicitArea = Boolean(hint || code || state);
  if (state && !/^[A-Z]{2}$/.test(state)) return noCounty;
  if (hint && !/^\d{5}$/.test(hint)) return noCounty;

  let county: ScoutCountyIdentity | undefined;
  if (hint) {
    county = COUNTY_BY_FIPS.get(hint);
  } else if (/^\d{5}$/.test(code)) {
    county = COUNTY_BY_FIPS.get(code);
  } else if (code) {
    const matches = COUNTIES.filter(
      (candidate) =>
        (!state || candidate.stateCode === state) && matchesCountyLabel(code, candidate)
    );
    county = matches.length === 1 ? matches[0] : undefined;
  } else if (!explicitArea) {
    const profileFips = normalizeScoutCountyFips(
      input.profileCountyFips,
      input.profileCountyFipsAlt
    );
    county = profileFips ? COUNTY_BY_FIPS.get(profileFips) : undefined;
  }

  if (!county || (state && county.stateCode !== state)) return noCounty;
  if (code && code !== county.fips && !matchesCountyLabel(code, county)) return noCounty;
  return { countyFips: county.fips, countyLabel: county.label };
}

/** Local discovery results change; replaying a cached narrative can hide new posts. */
export function requiresFreshScoutDiscovery(message: string): boolean {
  const text = String(message || "").toLowerCase();
  return (
    /\b(search|find|show|look)\b/.test(text) &&
    /\b(tradescout|site|local|near me|my area|my county)\b/.test(text) &&
    /\b(posts?|deals?|requests?|activity)\b/.test(text)
  );
}

/** County posts and deals are an explicit read-only local discovery request. */
export function isMixedScoutDiscoveryRequest(message: string): boolean {
  const value = String(message || "").toLowerCase();
  return (
    requiresFreshScoutDiscovery(value) &&
    /\bposts?\b/.test(value) &&
    /\bdeals?\b/.test(value)
  );
}

const BARE_DISCOVERY_TRADES = new Set(
  COMPREHENSIVE_TRADES.map((trade) => trade.id.toLowerCase()).filter((id) => /^[a-z]{2,30}$/.test(id))
);

export function readBareScoutTrade(message: string): string | null {
  const topic = String(message || "").trim().toLowerCase();
  return BARE_DISCOVERY_TRADES.has(topic) ? topic : null;
}

/** Interpret a single trade word only in the immediately preceding county-search context. */
export function resolveScoutMixedDiscoveryFollowUp(
  message: string,
  history: ReadonlyArray<{ role: string; content: string }>
): string | null {
  const topic = readBareScoutTrade(message);
  if (!topic) return null;
  const previousAnswer = history.at(-1);
  const previousRequest = history.at(-2);
  if (
    previousAnswer?.role !== "assistant" ||
    previousRequest?.role !== "user" ||
    !isMixedScoutDiscoveryRequest(previousRequest.content) ||
    !previousAnswer.content.includes("Pages, tools, and other requests were not checked. Nothing was sent.")
  ) {
    return null;
  }
  return `Find TradeScout posts and deals about ${topic} near me`;
}

/**
 * The refinement control asks for public records only. A bare trade name in
 * this exact request is a search subject, not a request for physical work.
 * Extra instructions, urgent conditions, or sensitive details do not match.
 */
export function isReadOnlyScoutTradeLookup(message: string): boolean {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  const detailed = text.match(
    /^find tradescout posts? (?:&|and) deals? about ([a-z][a-z-]{1,29}) in my county this week\. include public posts linked to requests and local businesses\.?$/i
  );
  const short = text.match(
    /^find (?:tradescout|local) posts? (?:&|and) deals? about ([a-z][a-z-]{1,29}) near me\.?$/i
  );
  const subject = detailed?.[1] || short?.[1];
  return Boolean(
    subject && /^(?:electrical|wiring|gas|structural|foundation|load-bearing)$/i.test(subject)
  );
}
