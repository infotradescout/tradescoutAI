/**
 * Sanitized public discovery landing event (Phase 3A).
 * Observed attribution hints only — never mechanism claims.
 */

export const DISCOVERY_LANDING_EVENT = "discovery_landing" as const;

export type DiscoveryLandingEntityType = "business_marketplace" | "business_profile";

export type VerifiedDiscoveryAttribution = {
  entryRequestId: string;
  businessSlug: string;
  entityType: DiscoveryLandingEntityType;
  canonicalRoute: string;
  issuedAt: string;
};

const MAX_ROUTE_LENGTH = 120;
const MAX_HINT_LENGTH = 64;
const MAX_HOST_LENGTH = 253;
const MAX_ANON_LENGTH = 128;
const MAX_BUSINESS_SLUG_LENGTH = 64;
const MAX_REQUEST_ID_LENGTH = 128;
const MAX_ATTRIBUTION_TOKEN_LENGTH = 4096;

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

export function normalizeDiscoveryCanonicalRoute(raw: unknown): string | undefined {
  const pathOnly = String(raw ?? "")
    .trim()
    .split(/[?#]/)[0];
  if (!pathOnly.startsWith("/")) return undefined;
  if (pathOnly.length > MAX_ROUTE_LENGTH) return undefined;
  if (!/^\/[A-Za-z0-9/_-]*$/.test(pathOnly)) return undefined;
  return pathOnly.replace(/\/{2,}/g, "/");
}

export function normalizeDiscoveryBusinessSlug(raw: unknown): string | undefined {
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

export function normalizeDiscoveryEntryRequestId(raw: unknown): string | undefined {
  const value = String(raw ?? "").trim();
  if (!value || value.length > MAX_REQUEST_ID_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    return undefined;
  }
  return value;
}

export function isPublicBusinessRoute(route: string): boolean {
  return (
    route === "/" ||
    route === "/jw-stone" ||
    route.startsWith("/jw-stone/") ||
    route.startsWith("/stones/") ||
    route.startsWith("/materials/") ||
    /^\/(?:business|u|contractors|helpers)\/[^/]+(?:\/.*)?$/.test(route)
  );
}

export function businessSlugFromPublicRoute(route: string): string | undefined {
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
    return normalizeDiscoveryBusinessSlug(decodeURIComponent(match[1]));
  } catch {
    return undefined;
  }
}

/**
 * Bind a browser-visible public path to the published business identity.
 * Custom-domain profiles render at paths such as `/` and `/stones/...`, but
 * attribution identities must remain profile-scoped so they cannot be
 * confused with the first-party JW Stone marketplace routes.
 */
export function normalizeDiscoveryRouteForBusiness(
  businessSlugRaw: unknown,
  routeRaw: unknown
): string | undefined {
  const businessSlug = normalizeDiscoveryBusinessSlug(businessSlugRaw);
  const canonicalRoute = normalizeDiscoveryCanonicalRoute(routeRaw);
  if (!businessSlug || !canonicalRoute) return undefined;

  const routeBusinessSlug = businessSlugFromPublicRoute(canonicalRoute);
  if (routeBusinessSlug === businessSlug) return canonicalRoute;

  // An explicit profile route for another business is never reinterpreted.
  if (/^\/(?:business|u|contractors|helpers)\//i.test(canonicalRoute)) {
    return undefined;
  }

  const customDomainSuffix = canonicalRoute === "/" ? "" : canonicalRoute;
  return normalizeDiscoveryCanonicalRoute(`/u/${businessSlug}${customDomainSuffix}`);
}

export function normalizeDiscoveryAttributionToken(raw: unknown): string | undefined {
  const value = String(raw ?? "").trim();
  if (
    !value ||
    value.length > MAX_ATTRIBUTION_TOKEN_LENGTH ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  ) {
    return undefined;
  }
  return value;
}

export function isValidDiscoveryAttributionIdentity(
  identity: VerifiedDiscoveryAttribution
): boolean {
  const businessSlug = normalizeDiscoveryBusinessSlug(identity.businessSlug);
  const canonicalRoute = normalizeDiscoveryCanonicalRoute(identity.canonicalRoute);
  const entryRequestId = normalizeDiscoveryEntryRequestId(identity.entryRequestId);
  if (!businessSlug || !canonicalRoute || !entryRequestId) return false;
  if (!isPublicBusinessRoute(canonicalRoute)) return false;

  const routeBusinessSlug = businessSlugFromPublicRoute(canonicalRoute);
  if (routeBusinessSlug && routeBusinessSlug !== businessSlug) return false;

  if (
    identity.entityType !== "business_marketplace" &&
    identity.entityType !== "business_profile"
  ) {
    return false;
  }

  const expectedEntityType =
    businessSlug === "jw-stone" &&
    (canonicalRoute === "/" ||
      canonicalRoute === "/jw-stone" ||
      canonicalRoute.startsWith("/jw-stone/") ||
      canonicalRoute.startsWith("/stones/") ||
      canonicalRoute.startsWith("/materials/") ||
      canonicalRoute === "/u/jw-stone" ||
      canonicalRoute === "/business/jw-stone")
      ? "business_marketplace"
      : "business_profile";
  return identity.entityType === expectedEntityType;
}

/**
 * Allowlisted discovery_landing payload. Rejects unknown types and strips
 * forbidden fields (full URL, query, raw UA/IP, message text, etc.).
 */
export function sanitizeDiscoveryLandingEvent(
  event: Record<string, unknown>,
  opts?: {
    anonymousSessionId?: string | null;
    verifiedAttribution?: VerifiedDiscoveryAttribution | null;
  }
): Record<string, unknown> | null {
  if (!event || typeof event !== "object") return null;
  if (event.type !== DISCOVERY_LANDING_EVENT) return null;

  const verifiedAttribution = opts?.verifiedAttribution;
  if (!verifiedAttribution || !isValidDiscoveryAttributionIdentity(verifiedAttribution)) {
    return null;
  }

  // These are client consistency hints only. They may be compared to the
  // signed envelope, but never become the stored identity fields.
  const claimedBusinessSlug = normalizeDiscoveryBusinessSlug(event.businessSlug);
  const claimedEntityType = String(event.entityType ?? "").trim();
  const claimedCanonicalRoute = normalizeDiscoveryCanonicalRoute(
    event.canonicalRoute ?? event.route
  );
  if (
    (Object.prototype.hasOwnProperty.call(event, "businessSlug") &&
      claimedBusinessSlug !== verifiedAttribution.businessSlug) ||
    (Object.prototype.hasOwnProperty.call(event, "entityType") &&
      claimedEntityType !== verifiedAttribution.entityType) ||
    (Object.prototype.hasOwnProperty.call(event, "canonicalRoute") &&
      claimedCanonicalRoute !== verifiedAttribution.canonicalRoute) ||
    (Object.prototype.hasOwnProperty.call(event, "route") &&
      claimedCanonicalRoute !== verifiedAttribution.canonicalRoute) ||
    Object.prototype.hasOwnProperty.call(event, "entryRequestId")
  ) {
    return null;
  }

  const safe: Record<string, unknown> = {
    type: DISCOVERY_LANDING_EVENT,
    canonicalRoute: verifiedAttribution.canonicalRoute,
    entityType: verifiedAttribution.entityType,
    businessSlug: verifiedAttribution.businessSlug,
    entryRequestId: verifiedAttribution.entryRequestId,
    ts: verifiedAttribution.issuedAt,
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
  businessSlug: string;
  entityType: DiscoveryLandingEntityType;
  discoveryAttributionToken: string;
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
    // Identity values are consistency hints. The server derives persisted
    // identity from the verified token, never from these client fields.
    canonicalRoute: args.canonicalRoute,
    entityType: args.entityType,
    businessSlug: args.businessSlug,
    discoveryAttributionToken: normalizeDiscoveryAttributionToken(args.discoveryAttributionToken),
    ts: args.ts || new Date().toISOString(),
    sourceHint: normalizeDiscoverySourceHint(utmSource),
    referrerHost: normalizeReferrerHost(args.referrer),
    anonymousSessionId: args.anonymousSessionId || undefined,
  };
}
