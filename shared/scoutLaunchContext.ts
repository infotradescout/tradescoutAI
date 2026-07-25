export const SCOUT_LAUNCH_SOURCES = [
  "business_profile_call",
  "community_post",
  "county-community-path",
  "homescout_listing",
  "maps",
  "scout_resume",
  "trade_city_empty",
  "trade_county_empty",
  "trade_deal",
  "unauthorized",
] as const;

export type ScoutLaunchSource = (typeof SCOUT_LAUNCH_SOURCES)[number];

export type ScoutLaunchContextType =
  | "access_review"
  | "business_profile"
  | "classic_handoff"
  | "community_post"
  | "county"
  | "home_listing"
  | "map_entity"
  | "trade"
  | "trade_deal";

export interface ScoutLaunchContext {
  source?: ScoutLaunchSource;
  intent?: string;
  contextType: ScoutLaunchContextType;
  contextId?: string;
  listingId?: string;
  postId?: string;
  dealId?: string;
  businessId?: string;
  businessSlug?: string;
  /** Stable material / inventory slug from a public profile (e.g. honey-onyx). */
  itemId?: string;
  /** Human-readable material label from a public profile. */
  itemName?: string;
  entityId?: string;
  entityType?: string;
  trade?: string;
  county?: string;
  countyFips?: string;
  state?: string;
  city?: string;
}

export interface ScoutLaunchEnvelope {
  context: ScoutLaunchContext | null;
  prompt?: string;
  returnPath?: string;
  signature: string;
}

const SOURCE_SET = new Set<string>(SCOUT_LAUNCH_SOURCES);
const MAP_ENTITY_TYPES = new Set([
  "business",
  "food_truck",
  "parking_pass",
  "provider",
  "public_profile",
  "trade_deal",
]);
function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function cleanIdentifier(value: unknown): string | undefined {
  const cleaned = cleanText(value, 128);
  return cleaned && /^[a-zA-Z0-9_-]+$/.test(cleaned) ? cleaned : undefined;
}

function cleanSlug(value: unknown): string | undefined {
  const cleaned = cleanText(value, 128)?.toLowerCase();
  return cleaned && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(cleaned) ? cleaned : undefined;
}

function cleanIntent(value: unknown): string | undefined {
  const cleaned = cleanText(value, 64)?.toLowerCase();
  return cleaned && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(cleaned) ? cleaned : undefined;
}

function cleanLabel(value: unknown): string | undefined {
  const cleaned = cleanText(value, 120);
  if (!cleaned) return undefined;
  const safe = cleaned.replace(/[^\p{L}\p{N} .,'&()/_-]/gu, "").trim();
  return safe || undefined;
}

function cleanState(value: unknown): string | undefined {
  const cleaned = cleanText(value, 32);
  return cleaned && /^[a-zA-Z]{2}$/.test(cleaned) ? cleaned.toUpperCase() : undefined;
}

function cleanCountyFips(value: unknown): string | undefined {
  const cleaned = cleanText(value, 5);
  return cleaned && /^\d{5}$/.test(cleaned) ? cleaned : undefined;
}

function cleanSource(value: unknown): ScoutLaunchSource | undefined {
  const cleaned = cleanText(value, 64)?.toLowerCase();
  return cleaned && SOURCE_SET.has(cleaned) ? (cleaned as ScoutLaunchSource) : undefined;
}

function readRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export function normalizeScoutLaunchContext(input: unknown): ScoutLaunchContext | undefined {
  const raw = readRecord(input);
  const source = cleanSource(raw.source);
  const intent = cleanIntent(raw.intent);
  const listingId = cleanIdentifier(raw.listingId);
  const postId = cleanIdentifier(raw.postId);
  const dealId = cleanIdentifier(raw.dealId);
  const businessId = cleanIdentifier(raw.businessId);
  const businessSlug = cleanSlug(raw.businessSlug);
  // Public profile URLs use `stone=`; Scout handoffs use `itemId=`.
  const itemId = cleanSlug(raw.itemId ?? raw.stone);
  const itemName = cleanLabel(raw.itemName ?? raw.item);
  const entityId = cleanIdentifier(raw.entityId);
  const entityTypeCandidate = cleanSlug(raw.entityType);
  const entityType =
    entityTypeCandidate && MAP_ENTITY_TYPES.has(entityTypeCandidate)
      ? entityTypeCandidate
      : undefined;
  const trade = cleanSlug(raw.trade);
  const county = cleanLabel(raw.county);
  const countyFips = cleanCountyFips(raw.countyFips);
  const state = cleanState(raw.state ?? raw.stateCode);
  const city = cleanLabel(raw.city);

  let contextType: ScoutLaunchContextType | undefined;
  let contextId: string | undefined;

  if (listingId) {
    contextType = "home_listing";
    contextId = listingId;
  } else if (postId) {
    contextType = "community_post";
    contextId = postId;
  } else if (dealId) {
    contextType = "trade_deal";
    contextId = dealId;
  } else if (businessId || businessSlug) {
    contextType = "business_profile";
    contextId = businessId || businessSlug;
  } else if (entityId && entityType) {
    contextType = "map_entity";
    contextId = entityId;
  } else if (county || countyFips) {
    contextType = "county";
    contextId = countyFips || county;
  } else if (trade) {
    contextType = "trade";
    contextId = trade;
  } else if (source === "unauthorized" || intent === "access-review") {
    contextType = "access_review";
  } else if (source || intent) {
    contextType = "classic_handoff";
  }

  if (!contextType) return undefined;

  return {
    ...(source ? { source } : {}),
    ...(intent ? { intent } : {}),
    contextType,
    ...(contextId ? { contextId } : {}),
    ...(listingId ? { listingId } : {}),
    ...(postId ? { postId } : {}),
    ...(dealId ? { dealId } : {}),
    ...(businessId ? { businessId } : {}),
    ...(businessSlug ? { businessSlug } : {}),
    ...(itemId ? { itemId } : {}),
    ...(itemName ? { itemName } : {}),
    ...(entityId && entityType ? { entityId, entityType } : {}),
    ...(trade ? { trade } : {}),
    ...(county ? { county } : {}),
    ...(countyFips ? { countyFips } : {}),
    ...(state ? { state } : {}),
    ...(city ? { city } : {}),
  };
}

function paramsToRecord(params: URLSearchParams): Record<string, string> {
  const record: Record<string, string> = {};
  for (const key of [
    "source",
    "intent",
    "listingId",
    "postId",
    "dealId",
    "businessId",
    "businessSlug",
    "itemId",
    "stone",
    "item",
    "itemName",
    "entityId",
    "entityType",
    "trade",
    "county",
    "countyFips",
    "state",
    "stateCode",
    "city",
  ]) {
    const value = params.get(key);
    if (value !== null) record[key] = value;
  }
  return record;
}

function slugifyPathPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getScoutLaunchReturnPath(context: ScoutLaunchContext): string | undefined {
  if (context.contextType === "home_listing" && context.listingId) {
    return `/homescout/listings/${encodeURIComponent(context.listingId)}`;
  }
  if (context.contextType === "community_post") return "/community";
  if (context.contextType === "trade_deal") return "/trade-deals";
  if (context.contextType === "business_profile" && context.businessSlug) {
    if (context.source === "business_profile_call") {
      const stone = context.itemId ? `?stone=${encodeURIComponent(context.itemId)}` : "";
      return `/u/${encodeURIComponent(context.businessSlug)}${stone}`;
    }
    return `/business/${encodeURIComponent(context.businessSlug)}`;
  }
  if (context.contextType === "map_entity") return "/maps";
  if (context.source === "trade_city_empty" && context.trade && context.state && context.city) {
    return `/trade/${encodeURIComponent(context.trade)}/${encodeURIComponent(
      context.state.toLowerCase()
    )}/city/${encodeURIComponent(slugifyPathPart(context.city))}`;
  }
  if (context.source === "trade_county_empty" && context.trade && context.state && context.county) {
    return `/trade/${encodeURIComponent(context.trade)}/${encodeURIComponent(
      context.state.toLowerCase()
    )}/${encodeURIComponent(slugifyPathPart(context.county))}`;
  }
  if (context.source === "county-community-path" && context.state && context.county) {
    return `/county/${encodeURIComponent(context.state.toLowerCase())}/${encodeURIComponent(
      slugifyPathPart(context.county)
    )}`;
  }
  return undefined;
}

export function parseScoutLaunchLocation(location: string): ScoutLaunchEnvelope {
  if (typeof location !== "string" || (location !== "/scout" && !location.startsWith("/scout?"))) {
    return { context: null, signature: "" };
  }

  const searchIndex = location.indexOf("?");
  const params = new URLSearchParams(searchIndex >= 0 ? location.slice(searchIndex + 1) : "");
  const context = normalizeScoutLaunchContext(paramsToRecord(params)) ?? null;
  const prompt = cleanText(params.get("prompt"), 2000);
  const returnPath = context ? getScoutLaunchReturnPath(context) : undefined;
  const signature = JSON.stringify({ context, prompt: prompt || null });

  return {
    context,
    ...(prompt ? { prompt } : {}),
    ...(returnPath ? { returnPath } : {}),
    signature,
  };
}

export function buildScoutLaunchContextCacheKey(
  context: ScoutLaunchContext | undefined
): string | undefined {
  if (!context) return undefined;
  return [
    context.source || "direct",
    context.contextType,
    context.contextId || "none",
    context.itemId || "none",
    context.trade || "none",
    context.countyFips || context.county || "none",
    context.state || "none",
  ].join(":");
}
