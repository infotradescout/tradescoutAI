/**
 * Sanitized public discovery landing event (Phase 3A).
 * Observed attribution hints only — never mechanism claims.
 */

export const DISCOVERY_LANDING_EVENT = "discovery_landing" as const;

export type DiscoveryLandingEntityType = "business_marketplace";

const MAX_ROUTE_LENGTH = 120;
const MAX_HINT_LENGTH = 64;
const MAX_HOST_LENGTH = 253;
const MAX_ANON_LENGTH = 128;

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

  const businessSlug = String(event.businessSlug ?? "")
    .trim()
    .toLowerCase();
  if (businessSlug !== "jw-stone") return null;

  const entityType = String(event.entityType ?? "").trim();
  if (entityType !== "business_marketplace") return null;

  const canonicalRoute = normalizeCanonicalRoute(event.canonicalRoute ?? event.route);
  if (!canonicalRoute) return null;

  // JW marketplace surfaces only (platform + custom-host collection / deep links).
  const isJwRoute =
    canonicalRoute === "/jw-stone" ||
    canonicalRoute.startsWith("/jw-stone/") ||
    canonicalRoute === "/" ||
    canonicalRoute.startsWith("/stones/") ||
    canonicalRoute.startsWith("/materials/");
  if (!isJwRoute) return null;

  const safe: Record<string, unknown> = {
    type: DISCOVERY_LANDING_EVENT,
    canonicalRoute,
    entityType: "business_marketplace" satisfies DiscoveryLandingEntityType,
    businessSlug: "jw-stone",
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

  return safe;
}

export function buildClientDiscoveryLandingPayload(args: {
  canonicalRoute: string;
  searchParams?: URLSearchParams | { get: (key: string) => string | null };
  referrer?: string | null;
  anonymousSessionId?: string | null;
  ts?: string;
}): Record<string, unknown> {
  const utmSource =
    args.searchParams && typeof args.searchParams.get === "function"
      ? args.searchParams.get("utm_source")
      : null;

  return {
    type: DISCOVERY_LANDING_EVENT,
    canonicalRoute: args.canonicalRoute,
    entityType: "business_marketplace",
    businessSlug: "jw-stone",
    ts: args.ts || new Date().toISOString(),
    sourceHint: normalizeDiscoverySourceHint(utmSource),
    referrerHost: normalizeReferrerHost(args.referrer),
    anonymousSessionId: args.anonymousSessionId || undefined,
  };
}
