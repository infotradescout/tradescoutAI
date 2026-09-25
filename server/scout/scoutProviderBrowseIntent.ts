import { getCountiesByState } from "../../shared/states-counties";
import { US_STATES } from "../../shared/us-states-counties";

type ProviderBrowseContext = {
  countyCode?: string;
  stateCode?: string;
};

export type ProviderBrowseIntent = {
  path: string;
  tradeSlug: string | null;
  countyFips: string | null;
  stateCode: string | null;
  areaLabel: string | null;
  areaNeedsSelection: boolean;
  requestedArea: string | null;
};

const PROVIDER_NOUN =
  /\b(pros?|providers?|contractors?|businesses?|companies?|firms?|roofers?|plumbers?|electricians?|painters?|builders?|landscapers?|mechanics?)\b/i;
const BROWSE_VERB =
  /\b(find|show(?: me)?|search(?: for)?|browse|compare|look(?:ing)? for|see)\b/i;

const TRADE_TERMS: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /\b(roofers?|roofing|roof)\b/i, slug: "roofing" },
  { pattern: /\b(plumbers?|plumbing|pipes?|drains?)\b/i, slug: "plumbing" },
  { pattern: /\b(electricians?|electrical|wiring|outlets?)\b/i, slug: "electrical" },
  { pattern: /\b(hvac|air conditioning|heating|furnace)\b/i, slug: "hvac" },
  { pattern: /\binterior painting\b/i, slug: "interior-painting" },
  { pattern: /\bexterior painting\b/i, slug: "exterior-painting" },
  { pattern: /\b(decks?|decking)\b/i, slug: "deck-contractor" },
  { pattern: /\b(fences?|fencing)\b/i, slug: "fence-contractor" },
  { pattern: /\b(concrete|masonry)\b/i, slug: "concrete-contractor" },
  { pattern: /\b(landscapers?|landscaping)\b/i, slug: "landscaping" },
  { pattern: /\bbuilders?\b/i, slug: "custom-home-builder" },
];

function stateCodeFor(value: string | undefined): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  const state = US_STATES.find(
    (candidate) =>
      candidate.code.toLowerCase() === normalized || candidate.name.toLowerCase() === normalized
  );
  return state?.code || null;
}

function normalizeCountyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(county|parish|borough)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function isExplicitProviderBrowseIntent(message: string): boolean {
  return (
    BROWSE_VERB.test(message) &&
    PROVIDER_NOUN.test(message) &&
    !/\b(exchange|marketplace|listings?)\b/i.test(message) &&
    !/\bmy\s+(?:business(?:es)?|contractors?|providers?|pros?)\b/i.test(message) &&
    !/\b(?:contractor|provider)\s+(?:requests?|jobs?|inbox)\b/i.test(message) &&
    !/\bmy\s+(?:requests?|jobs?|projects?|inbox|messages?|conversations?)\b/i.test(message) &&
    !/\b(?:replied|responded|messaged)\s+(?:to\s+)?me\b/i.test(message)
  );
}

export function resolveProviderBrowseIntent(
  message: string,
  context: ProviderBrowseContext = {}
): ProviderBrowseIntent | null {
  if (!isExplicitProviderBrowseIntent(message)) return null;

  const countyMention = message.match(
    /\b(?:in|near|around|for)\s+([A-Za-z][A-Za-z .'-]{1,60}?)\s+(County|Parish|Borough)\b/i
  );
  const cityStateMention = countyMention
    ? null
    : message.match(/\b(?:in|near|around)\s+([A-Za-z][A-Za-z .'-]{1,60}?),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z ]{2,30})\b/i);
  const trailingLocation = countyMention
    ? message.slice((countyMention.index || 0) + countyMention[0].length).trim()
    : "";
  const trailingState = trailingLocation.match(/^,?\s*([A-Za-z]{2})\b/);
  const namedTrailingState = US_STATES.find((state) =>
    new RegExp(`^,?\\s*${state.name}\\b`, "i").test(trailingLocation)
  );
  const explicitState = stateCodeFor(trailingState?.[1]) || namedTrailingState?.code || null;
  const stateOnly = countyMention
    ? null
    : message.match(/\b(?:in|near|around)\s+([A-Z]{2})\b/i);
  const namedStateOnly = countyMention
    ? undefined
    : US_STATES.find((state) =>
        new RegExp(`\\b(?:in|near|around)\\s+${state.name}\\b`, "i").test(message)
      );
  const requestedState =
    explicitState ||
    stateCodeFor(cityStateMention?.[2]) ||
    stateCodeFor(stateOnly?.[1]) ||
    namedStateOnly?.code;
  let stateCode = requestedState || stateCodeFor(context.stateCode);

  const countyName = countyMention?.[1]?.trim() || "";
  const contextCounty = String(context.countyCode || "").trim();
  const mayUseContextCounty =
    !countyMention && !cityStateMention && !requestedState;
  const countyToResolve = countyName || (mayUseContextCounty ? contextCounty : "");
  let matchingCounty =
    countyToResolve && stateCode
      ? getCountiesByState(stateCode).find(
          (county) =>
            county.fipsCode === countyToResolve ||
            normalizeCountyName(county.name) === normalizeCountyName(countyToResolve)
        )
      : undefined;
  if (countyName && !requestedState) {
    const matches = US_STATES.flatMap((state) => getCountiesByState(state.code))
      .filter((county) => normalizeCountyName(county.name) === normalizeCountyName(countyName));
    if (matches.length === 1) {
      matchingCounty = matches[0];
      stateCode = matches[0].state;
    } else {
      matchingCounty = undefined;
      stateCode = null;
    }
  }
  if (cityStateMention && !requestedState) stateCode = null;
  const countyFips = matchingCounty?.fipsCode || null;
  const areaNeedsSelection = Boolean((countyName && !matchingCounty) || cityStateMention);

  const tradeSlug = TRADE_TERMS.find((entry) => entry.pattern.test(message))?.slug || null;
  const params = new URLSearchParams();
  params.set("source", "scout");
  // Explicit blanks prevent an earlier directory session from adding an old
  // area, text filter, or selected provider to this new Scout search.
  params.set("state", stateCode || "");
  params.set("county", countyFips || "");
  params.set("trade", tradeSlug || "");
  params.set("q", "");
  params.set("selected", "");
  if (areaNeedsSelection) params.set("require_area", "1");

  const areaLabel = matchingCounty
    ? `${matchingCounty.name}, ${stateCode}`
    : stateCode || null;

  return {
    path: `/direct-connect/pros?${params.toString()}`,
    tradeSlug,
    countyFips,
    stateCode,
    areaLabel,
    areaNeedsSelection,
    requestedArea: countyName
      ? `${countyName} ${countyMention?.[2]}${requestedState ? `, ${requestedState}` : ""}`
      : cityStateMention
        ? `${cityStateMention[1].trim()}${requestedState ? `, ${requestedState}` : ""}`
        : null,
  };
}
