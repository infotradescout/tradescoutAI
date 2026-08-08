/**
 * Sanitized public discovery landing event (Phase 3A).
 * Observed attribution hints only — never mechanism claims.
 */

export const DISCOVERY_LANDING_EVENT = "discovery_landing" as const;

export type DiscoveryLandingEntityType = "business_marketplace" | "business_profile";

const MAX_ROUTE_LENGTH = 120;
const MAX_HINT_LENGTH = 64;
const MAX_HOST_LENGTH = 253;
const MAX_ANON_LENGTH = 128;
const MAX_BUSINESS_SLUG_LENGTH = 64;
const MAX_REQUEST_ID_LENGTH = 128;

/** utm_source=chatgpt.com → chatgpt. Never claims search/crawler causation. */
export function normalizeDiscoverySourceHint(raw: unknown): string | undefined {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!value) return undefined;
  if (value === "chatgpt.com" || value === "chatgpt") return "chatgpt";
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value)) return undefined;
  return value.slice(0, MAX_HINT_LENGTH);
}

/** Persist referrer host only — never full referrer URL. */
export function normalizeReferrerHost(raw: unknown): string | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    const host = url.hostname.toLowerCase();
    if (!host || host.length > MAX_HOST_LENGTH) return undefined;
    if (!/^[a-z0-9.-]+$/i.test(host)) return undefined;
    return host;
  } catch {
    return undefined;
  }
}

function normalizeCanonicalRoute(raw: unknown): string | undefined {
  const pathOnly = String(raw ?? "")
    .trim()
    .split(/[?#]/)[0];
  if (!pathOnly.startsWith("/")) return undefined;
  if (pathOnly.length > MAX_ROUTE_LENGTH) return undefined;
  if (!/^\/[A-Za-z0-9/_-]*$/.test(pathOnly)) return undefined;
  return pathOnly.replace(/\/{2,}/g, "/");
}

function normalizeBusinessSlug(raw: unknown): string | undefined {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    !value ||
    value.length > MAX_BUSINESS_SLUG_LENGTH ||
    !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value)
  ) {
    return undefined;
  }
  return value;
}

function normalizeEntryRequestId(raw: unknown): string | undefined {
  const value = String(raw ?? "").trim();
  if (!value || value.length > MAX_REQUEST_ID_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    return undefined;
  }
  return value;
}

function isPublicBusinessRoute(route: string): boolean {
  return (
    route === "/" ||
    route === "/jw-stone" ||
    route.startsWith("/jw-stone/") ||
    route.startsWith("/stones/") ||
    route.startsWith("/materials/") ||
    /^\/(?:business|u|contractors|helpers)\/[^/]+(?:\/.*)?$/.test(route)
  );
}

function businessSlugFromPublicRoute(route: string): string | undefined {
  if (
    route === "/" ||
    route === "/jw-stone" ||
    route.startsWith("/jw-stone/") ||
    route.startsWith("/stones/") ||
    route.startsWith("/materials/")
  ) {
    return "jw-stone";
  }

  const match = route.match(/^\/(?:business|u|contractors|helpers)\/([^/]+)/i);
  if (!match) return undefined;
  try {
    return normalizeBusinessSlug(decodeURIComponent(match[1]));
  } catch {
    return undefined;
  }
}

/**
 * Allowlisted discovery_landing payload. Rejects unknown types and strips
 * forbidden fields (full URL, query, raw UA/IP, message text, etc.).
 */
export function sanitizeDiscoveryLandingEvent(
  event: Record<string, unknown>,
  opts?: { anonymousSessionId?: string | null }
): Record<string, unknown> | null {
  if (!event || typeof event !== "object") return null;
  if (event.type !== DISCOVERY_LANDING_EVENT) return null;

  const businessSlug = normalizeBusinessSlug(event.businessSlug);
  if (!businessSlug) return null;

  const entityType = String(event.entityType ?? "").trim();
  if (entityType !== "business_marketplace" && entityType !== "business_profile") return null;

  const canonicalRoute = normalizeCanonicalRoute(event.canonicalRoute ?? event.route);
  if (!canonicalRoute) return null;

  if (!isPublicBusinessRoute(canonicalRoute)) return null;

  const routeBusinessSlug = businessSlugFromPublicRoute(canonicalRoute);
  if (!routeBusinessSlug || routeBusinessSlug !== businessSlug) return null;
  const expectedEntityType =
    routeBusinessSlug === "jw-stone" &&
    (canonicalRoute === "/" ||
      canonicalRoute === "/jw-stone" ||
      canonicalRoute.startsWith("/jw-stone/") ||
      canonicalRoute.startsWith("/stones/") ||
      canonicalRoute.startsWith("/materials/"))
      ? "business_marketplace"
      : "business_profile";
  if (entityType !== expectedEntityType) return null;

  const safe: Record<string, unknown> = {
    type: DISCOVERY_LANDING_EVENT,
    canonicalRoute,
    entityType,
    businessSlug,
    ts:
      typeof event.ts === "string" && event.ts.trim()
        ? event.ts.trim().slice(0, 40)
        : new Date().toISOString(),
  };

  const sourceHint = normalizeDiscoverySourceHint(
    event.sourceHint ?? event.utmSource ?? event.source
  );
  if (sourceHint) safe.sourceHint = sourceHint;

  const referrerHost = normalizeReferrerHost(event.referrerHost ?? event.referrer);
  if (referrerHost) safe.referrerHost = referrerHost;

  const anon =
    typeof opts?.anonymousSessionId === "string" && opts.anonymousSessionId.trim()
      ? opts.anonymousSessionId.trim()
      : typeof event.anonymousSessionId === "string"
        ? event.anonymousSessionId.trim()
        : "";
  if (anon && anon.length <= MAX_ANON_LENGTH && /^[A-Za-z0-9._:-]+$/.test(anon)) {
    safe.anonymousSessionId = anon.slice(0, MAX_ANON_LENGTH);
  }

  const entryRequestId = normalizeEntryRequestId(event.entryRequestId);
  if (entryRequestId) safe.entryRequestId = entryRequestId;

  return safe;
}

export function buildClientDiscoveryLandingPayload(args: {
  canonicalRoute: string;
  businessSlug: string;
  entityType: DiscoveryLandingEntityType;
  searchParams?: URLSearchParams | { get: (key: string) => string | null };
  referrer?: string | null;
  anonymousSessionId?: string | null;
  entryRequestId?: string | null;
  ts?: string;
}): Record<string, unknown> {
  const utmSource =
    args.searchParams && typeof args.searchParams.get === "function"
      ? args.searchParams.get("utm_source")
      : null;

  return {
    type: DISCOVERY_LANDING_EVENT,
    canonicalRoute: args.canonicalRoute,
    entityType: args.entityType,
    businessSlug: args.businessSlug,
    ts: args.ts || new Date().toISOString(),
    sourceHint: normalizeDiscoverySourceHint(utmSource),
    referrerHost: normalizeReferrerHost(args.referrer),
    anonymousSessionId: args.anonymousSessionId || undefined,
    entryRequestId: args.entryRequestId || undefined,
  };
}
