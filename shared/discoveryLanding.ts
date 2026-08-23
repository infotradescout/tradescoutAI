/**
 * Sanitized public discovery landing event (Phase 3A).
 * Observed attribution hints only — never mechanism claims.
 */

export const DISCOVERY_LANDING_EVENT = "discovery_landing" as const;
export const PUBLIC_PROFILE_DISCOVERY_EVENT = "public_profile_discovered" as const;
export const PUBLIC_PROFILE_CTA_EVENT = "public_profile_cta" as const;

export const PUBLIC_PROFILE_CTA_KINDS = [
  "direct_connect",
  "account_create",
  "business_claim",
  "booking_request",
] as const;

export type PublicProfileCtaKind = (typeof PUBLIC_PROFILE_CTA_KINDS)[number];

export type DiscoveryLandingEntityType =
  | "business_marketplace"
  | "business_profile"
  | "public_profile";

export type VerifiedDiscoveryAttribution = {
  entryRequestId: string;
  entitySlug: string;
  businessSlug?: string;
  profileSlug?: string;
  entityType: DiscoveryLandingEntityType;
  canonicalRoute: string;
  issuedAt: string;
};

const MAX_ROUTE_LENGTH = 120;
const MAX_HOST_LENGTH = 253;
const MAX_BUSINESS_SLUG_LENGTH = 64;
const MAX_REQUEST_ID_LENGTH = 128;
const MAX_ATTRIBUTION_TOKEN_LENGTH = 4096;

export type DiscoverySourceClass =
  | "google"
  | "bing"
  | "chatgpt"
  | "facebook"
  | "linkedin"
  | "newsletter"
  | "direct"
  | "other";

export type DiscoveryReferrerClass =
  | "google"
  | "bing"
  | "chatgpt"
  | "facebook"
  | "linkedin"
  | "search"
  | "ai"
  | "social"
  | "referral";

const SOURCE_CLASS_ALIASES: Readonly<Record<string, DiscoverySourceClass>> = {
  google: "google",
  "google.com": "google",
  googleads: "google",
  google_ads: "google",
  adwords: "google",
  bing: "bing",
  "bing.com": "bing",
  microsoft: "bing",
  chatgpt: "chatgpt",
  "chatgpt.com": "chatgpt",
  openai: "chatgpt",
  "openai.com": "chatgpt",
  facebook: "facebook",
  "facebook.com": "facebook",
  fb: "facebook",
  instagram: "facebook",
  "instagram.com": "facebook",
  meta: "facebook",
  linkedin: "linkedin",
  "linkedin.com": "linkedin",
  newsletter: "newsletter",
  email: "newsletter",
  direct: "direct",
  none: "direct",
  other: "other",
};

/**
 * Converts an untrusted UTM value to a fixed source vocabulary. Unknown,
 * contact-like, and stable-identifier values are bucketed as `other`; the raw
 * value is never returned or persisted.
 */
export function normalizeDiscoverySourceHint(raw: unknown): string | undefined {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!value) return undefined;
  return SOURCE_CLASS_ALIASES[value] || "other";
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/**
 * Converts an untrusted referrer to a fixed family. It never returns the raw
 * host, subdomain, path, query, or fragment, keeping event cardinality bounded.
 */
export function normalizeDiscoveryReferrerClass(raw: unknown): DiscoveryReferrerClass | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  const finiteClass = value.toLowerCase();
  if (
    finiteClass === "google" ||
    finiteClass === "bing" ||
    finiteClass === "chatgpt" ||
    finiteClass === "facebook" ||
    finiteClass === "linkedin" ||
    finiteClass === "search" ||
    finiteClass === "ai" ||
    finiteClass === "social" ||
    finiteClass === "referral"
  ) {
    return finiteClass;
  }
  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    const host = url.hostname.toLowerCase();
    if (!host || host.length > MAX_HOST_LENGTH) return undefined;
    if (!/^[a-z0-9.-]+$/i.test(host)) return undefined;
    if (hostMatches(host, "google.com") || /^google\.[a-z.]{2,12}$/.test(host)) {
      return "google";
    }
    if (hostMatches(host, "bing.com")) return "bing";
    if (hostMatches(host, "chatgpt.com") || hostMatches(host, "openai.com")) {
      return "chatgpt";
    }
    if (hostMatches(host, "facebook.com") || hostMatches(host, "instagram.com")) {
      return "facebook";
    }
    if (hostMatches(host, "linkedin.com")) return "linkedin";
    if (
      hostMatches(host, "duckduckgo.com") ||
      hostMatches(host, "yahoo.com") ||
      hostMatches(host, "search.brave.com")
    ) {
      return "search";
    }
    if (
      hostMatches(host, "perplexity.ai") ||
      hostMatches(host, "claude.ai") ||
      hostMatches(host, "gemini.google.com") ||
      hostMatches(host, "copilot.microsoft.com")
    ) {
      return "ai";
    }
    if (
      hostMatches(host, "x.com") ||
      hostMatches(host, "twitter.com") ||
      hostMatches(host, "t.co") ||
      hostMatches(host, "reddit.com")
    ) {
      return "social";
    }
    return "referral";
  } catch {
    return undefined;
  }
}

/** @deprecated New acquisition events persist only the finite referrer class. */
export const normalizeReferrerHost = normalizeDiscoveryReferrerClass;

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

export const normalizeDiscoveryEntitySlug = normalizeDiscoveryBusinessSlug;
export const normalizeDiscoveryProfileSlug = normalizeDiscoveryBusinessSlug;

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
  const entitySlug = normalizeDiscoveryEntitySlug(identity.entitySlug);
  const canonicalRoute = normalizeDiscoveryCanonicalRoute(identity.canonicalRoute);
  const entryRequestId = normalizeDiscoveryEntryRequestId(identity.entryRequestId);
  if (!entitySlug || !canonicalRoute || !entryRequestId) return false;
  if (!isPublicBusinessRoute(canonicalRoute)) return false;

  const routeEntitySlug = entitySlugFromPublicRoute(canonicalRoute);
  if (routeEntitySlug && routeEntitySlug !== entitySlug) return false;

  if (identity.entityType === "public_profile") {
    return (
      normalizeDiscoveryProfileSlug(identity.profileSlug) === entitySlug &&
      !identity.businessSlug &&
      /^\/u\/[^/]+$/i.test(canonicalRoute) &&
      entitySlug !== "jw-stone"
    );
  }

  if (
    identity.entityType !== "business_marketplace" &&
    identity.entityType !== "business_profile"
  ) {
    return false;
  }
  if (
    normalizeDiscoveryBusinessSlug(identity.businessSlug) !== entitySlug ||
    identity.profileSlug
  ) {
    return false;
  }

  const expectedEntityType =
    entitySlug === "jw-stone" &&
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

function verifiedDiscoveryIdentityFields(
  attribution: VerifiedDiscoveryAttribution
): Record<string, string> {
  return attribution.entityType === "public_profile"
    ? { entitySlug: attribution.entitySlug, profileSlug: attribution.profileSlug || "" }
    : { entitySlug: attribution.entitySlug, businessSlug: attribution.businessSlug || "" };
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
  const claimedEntitySlug = normalizeDiscoveryEntitySlug(event.entitySlug);
  const claimedBusinessSlug = normalizeDiscoveryBusinessSlug(event.businessSlug);
  const claimedProfileSlug = normalizeDiscoveryProfileSlug(event.profileSlug);
  const claimedEntityType = String(event.entityType ?? "").trim();
  const claimedCanonicalRoute = normalizeDiscoveryCanonicalRoute(
    event.canonicalRoute ?? event.route
  );
  if (
    (Object.prototype.hasOwnProperty.call(event, "entitySlug") &&
      claimedEntitySlug !== verifiedAttribution.entitySlug) ||
    (Object.prototype.hasOwnProperty.call(event, "businessSlug") &&
      claimedBusinessSlug !== verifiedAttribution.businessSlug) ||
    (Object.prototype.hasOwnProperty.call(event, "profileSlug") &&
      claimedProfileSlug !== verifiedAttribution.profileSlug) ||
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
    serverVerified: true,
    canonicalRoute: verifiedAttribution.canonicalRoute,
    entityType: verifiedAttribution.entityType,
    ...verifiedDiscoveryIdentityFields(verifiedAttribution),
    entryRequestId: verifiedAttribution.entryRequestId,
    ts: verifiedAttribution.issuedAt,
  };

  const sourceHint = normalizeDiscoverySourceHint(
    event.sourceHint ?? event.utmSource ?? event.source
  );
  if (sourceHint) safe.sourceHint = sourceHint;

  const referrerClass = normalizeDiscoveryReferrerClass(
    event.referrerClass ?? event.referrerHost ?? event.referrer
  );
  if (referrerClass) safe.referrerClass = referrerClass;

  return safe;
}

export const entitySlugFromPublicRoute = businessSlugFromPublicRoute;

/**
 * Allowlisted public-profile CTA milestone. Identity always comes from the
 * signed discovery envelope; client-provided identity is consistency-only.
 * Raw URLs, labels, text, user-agent, IP, and arbitrary action names are never
 * persisted through this contract.
 */
export function sanitizePublicProfileCtaEvent(
  event: Record<string, unknown>,
  opts?: {
    anonymousSessionId?: string | null;
    verifiedAttribution?: VerifiedDiscoveryAttribution | null;
    observedAt?: string;
  }
): Record<string, unknown> | null {
  if (!event || typeof event !== "object" || event.type !== PUBLIC_PROFILE_CTA_EVENT) {
    return null;
  }

  const verifiedAttribution = opts?.verifiedAttribution;
  if (
    !verifiedAttribution ||
    !isValidDiscoveryAttributionIdentity(verifiedAttribution) ||
    verifiedAttribution.entityType === "business_marketplace"
  ) {
    return null;
  }

  const ctaKind = String(event.ctaKind ?? "").trim() as PublicProfileCtaKind;
  if (!PUBLIC_PROFILE_CTA_KINDS.includes(ctaKind)) return null;

  const claimedEntitySlug = normalizeDiscoveryEntitySlug(event.entitySlug);
  const claimedBusinessSlug = normalizeDiscoveryBusinessSlug(event.businessSlug);
  const claimedProfileSlug = normalizeDiscoveryProfileSlug(event.profileSlug);
  const claimedEntityType = String(event.entityType ?? "").trim();
  const claimedCanonicalRoute = normalizeDiscoveryCanonicalRoute(
    event.canonicalRoute ?? event.route
  );
  if (
    (Object.prototype.hasOwnProperty.call(event, "entitySlug") &&
      claimedEntitySlug !== verifiedAttribution.entitySlug) ||
    (Object.prototype.hasOwnProperty.call(event, "businessSlug") &&
      claimedBusinessSlug !== verifiedAttribution.businessSlug) ||
    (Object.prototype.hasOwnProperty.call(event, "profileSlug") &&
      claimedProfileSlug !== verifiedAttribution.profileSlug) ||
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

  const observedAtMs = Date.parse(String(opts?.observedAt || ""));
  const safe: Record<string, unknown> = {
    type: PUBLIC_PROFILE_CTA_EVENT,
    serverVerified: true,
    ctaKind,
    canonicalRoute: verifiedAttribution.canonicalRoute,
    entityType: verifiedAttribution.entityType,
    ...verifiedDiscoveryIdentityFields(verifiedAttribution),
    entryRequestId: verifiedAttribution.entryRequestId,
    ts: Number.isFinite(observedAtMs)
      ? new Date(observedAtMs).toISOString()
      : new Date().toISOString(),
  };

  return safe;
}

export function buildClientDiscoveryLandingPayload(args: {
  canonicalRoute: string;
  entitySlug?: string;
  businessSlug?: string;
  profileSlug?: string;
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
  const entitySlug = normalizeDiscoveryEntitySlug(
    args.entitySlug || args.profileSlug || args.businessSlug
  );

  return {
    type: DISCOVERY_LANDING_EVENT,
    // Identity values are consistency hints. The server derives persisted
    // identity from the verified token, never from these client fields.
    canonicalRoute: args.canonicalRoute,
    entityType: args.entityType,
    entitySlug,
    ...(args.entityType === "public_profile"
      ? { profileSlug: normalizeDiscoveryProfileSlug(args.profileSlug || entitySlug) }
      : { businessSlug: normalizeDiscoveryBusinessSlug(args.businessSlug || entitySlug) }),
    discoveryAttributionToken: normalizeDiscoveryAttributionToken(args.discoveryAttributionToken),
    ts: args.ts || new Date().toISOString(),
    sourceHint: normalizeDiscoverySourceHint(utmSource),
    referrerClass: normalizeDiscoveryReferrerClass(args.referrer),
  };
}

export function buildClientPublicProfileCtaPayload(args: {
  ctaKind: PublicProfileCtaKind;
  canonicalRoute: string;
  entitySlug?: string;
  businessSlug?: string;
  profileSlug?: string;
  entityType: DiscoveryLandingEntityType;
  discoveryAttributionToken: string;
}): Record<string, unknown> {
  const entitySlug = normalizeDiscoveryEntitySlug(
    args.entitySlug || args.profileSlug || args.businessSlug
  );
  return {
    type: PUBLIC_PROFILE_CTA_EVENT,
    ctaKind: args.ctaKind,
    canonicalRoute: normalizeDiscoveryCanonicalRoute(args.canonicalRoute),
    entityType: args.entityType,
    entitySlug,
    ...(args.entityType === "public_profile"
      ? { profileSlug: normalizeDiscoveryProfileSlug(args.profileSlug || entitySlug) }
      : { businessSlug: normalizeDiscoveryBusinessSlug(args.businessSlug || entitySlug) }),
    discoveryAttributionToken: normalizeDiscoveryAttributionToken(args.discoveryAttributionToken),
  };
}
