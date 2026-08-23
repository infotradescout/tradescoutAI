import {
  buildClientPublicProfileCtaPayload,
  buildClientDiscoveryLandingPayload,
  DISCOVERY_LANDING_EVENT,
  normalizeDiscoveryCanonicalRoute,
  normalizeDiscoveryAttributionToken,
} from "@shared/discoveryLanding";
import type { DiscoveryLandingEntityType, PublicProfileCtaKind } from "@shared/discoveryLanding";

let lastDiscoveryLandingKey: string | null = null;
const recordedPublicProfileCtaKeys = new Set<string>();
export const DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY = "tradescout:discovery-attribution:v1";

export type StoredDiscoveryLandingAttribution = {
  discoveryAttributionToken: string;
  entitySlug: string;
  businessSlug?: string;
  profileSlug?: string;
};

export function readPublishedDiscoveryAttributionToken(): string | null {
  if (typeof document === "undefined") return null;
  return (
    normalizeDiscoveryAttributionToken(
      document
        .querySelector('meta[name="tradescout-discovery-attribution"]')
        ?.getAttribute("content")
    ) ?? null
  );
}

export function getPublishedDiscoveryCanonicalRoute(): string | null {
  if (typeof document === "undefined") return null;
  const signedIdentityRoute = normalizeDiscoveryCanonicalRoute(
    document.querySelector('meta[name="tradescout-discovery-route"]')?.getAttribute("content")
  );
  if (signedIdentityRoute) return signedIdentityRoute;
  const raw = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
  if (!raw) return null;
  try {
    return normalizeDiscoveryCanonicalRoute(new URL(raw, window.location.origin).pathname) ?? null;
  } catch {
    return null;
  }
}

function readMeta(name: string): string | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") || null;
}

export function getPublishedDiscoveryIdentity(): {
  entitySlug: string;
  businessSlug?: string;
  profileSlug?: string;
  entityType: DiscoveryLandingEntityType;
} | null {
  const businessSlug = String(readMeta("tradescout-business-slug") || "")
    .trim()
    .toLowerCase();
  const profileSlug = String(readMeta("tradescout-profile-slug") || "")
    .trim()
    .toLowerCase();
  const entityType = String(
    readMeta("tradescout-business-entity-type") || readMeta("tradescout-profile-entity-type") || ""
  ).trim() as DiscoveryLandingEntityType;
  const entitySlug = entityType === "public_profile" ? profileSlug : businessSlug;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(entitySlug)) return null;
  if (
    entityType !== "business_profile" &&
    entityType !== "business_marketplace" &&
    entityType !== "public_profile"
  ) {
    return null;
  }
  return entityType === "public_profile"
    ? { entitySlug, profileSlug: entitySlug, entityType }
    : { entitySlug, businessSlug: entitySlug, entityType };
}

export function getStoredDiscoveryLandingAttribution(
  profileSlug: string
): StoredDiscoveryLandingAttribution | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY) || "null"
    );
    const discoveryAttributionToken = normalizeDiscoveryAttributionToken(
      parsed?.discoveryAttributionToken
    );
    const storedEntitySlug = String(
      parsed?.entitySlug || parsed?.profileSlug || parsed?.businessSlug || ""
    )
      .trim()
      .toLowerCase();
    const expectedEntitySlug = String(profileSlug || "")
      .trim()
      .toLowerCase();
    return discoveryAttributionToken && storedEntitySlug && storedEntitySlug === expectedEntitySlug
      ? {
          discoveryAttributionToken,
          entitySlug: storedEntitySlug,
          ...(parsed?.profileSlug
            ? { profileSlug: storedEntitySlug }
            : { businessSlug: storedEntitySlug }),
        }
      : null;
  } catch {
    return null;
  }
}

/** Test helper - clears in-memory once-per-landing dedupe. */
export function resetDiscoveryLandingDedupeForTests(): void {
  lastDiscoveryLandingKey = null;
  recordedPublicProfileCtaKeys.clear();
}

/**
 * Best-effort, non-blocking discovery_landing. Never throws into UX.
 * Dedupes React remount / rerender double-fires for the same landing key.
 */
export async function trackDiscoveryLandingOnce(options: {
  canonicalRoute: string;
  search?: string;
  referrer?: string | null;
  anonymousSessionId?: string | null;
}): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;

    const identity = getPublishedDiscoveryIdentity();
    const discoveryAttributionToken = readPublishedDiscoveryAttributionToken();
    if (!identity || !discoveryAttributionToken) return false;

    const params = new URLSearchParams(
      options.search ?? (typeof window !== "undefined" ? window.location.search : "")
    );
    const raw = buildClientDiscoveryLandingPayload({
      canonicalRoute: options.canonicalRoute,
      entitySlug: identity.entitySlug,
      businessSlug: identity.businessSlug,
      profileSlug: identity.profileSlug,
      entityType: identity.entityType,
      discoveryAttributionToken,
      searchParams: params,
      referrer:
        options.referrer ?? (typeof document !== "undefined" ? document.referrer || null : null),
      anonymousSessionId: options.anonymousSessionId ?? null,
    });
    if (!raw.discoveryAttributionToken) return false;

    try {
      window.sessionStorage.setItem(
        DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY,
        JSON.stringify({
          discoveryAttributionToken: raw.discoveryAttributionToken,
          entitySlug: identity.entitySlug,
          ...(identity.profileSlug
            ? { profileSlug: identity.profileSlug }
            : { businessSlug: identity.businessSlug }),
        })
      );
    } catch {
      // Attribution storage is best-effort and never affects the landing UX.
    }

    const dedupeKey = [
      raw.discoveryAttributionToken,
      raw.canonicalRoute,
      raw.sourceHint,
      raw.referrerClass,
    ]
      .map((value) => String(value || ""))
      .join("|");
    if (lastDiscoveryLandingKey === dedupeKey) return false;
    lastDiscoveryLandingKey = dedupeKey;

    await fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(raw),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort public-profile CTA milestone. The action vocabulary is fixed,
 * identity comes from the signed SSR envelope, and the same CTA is recorded
 * at most once per landing in this browser runtime.
 */
export async function trackPublicProfileCtaOnce(options: {
  ctaKind: PublicProfileCtaKind;
  canonicalRoute?: string;
}): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    const identity = getPublishedDiscoveryIdentity();
    const discoveryAttributionToken = readPublishedDiscoveryAttributionToken();
    const canonicalRoute =
      normalizeDiscoveryCanonicalRoute(options.canonicalRoute) ||
      getPublishedDiscoveryCanonicalRoute();
    if (
      !identity ||
      identity.entityType === "business_marketplace" ||
      !discoveryAttributionToken ||
      !canonicalRoute
    ) {
      return false;
    }

    const dedupeKey = [discoveryAttributionToken, options.ctaKind].join("|");
    if (recordedPublicProfileCtaKeys.has(dedupeKey)) return false;
    recordedPublicProfileCtaKeys.add(dedupeKey);

    const payload = buildClientPublicProfileCtaPayload({
      ctaKind: options.ctaKind,
      canonicalRoute,
      entitySlug: identity.entitySlug,
      businessSlug: identity.businessSlug,
      profileSlug: identity.profileSlug,
      entityType: identity.entityType,
      discoveryAttributionToken,
    });
    if (!payload.discoveryAttributionToken || !payload.canonicalRoute) return false;

    await fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}

const PRIMARY_TRADESCOUT_HOSTS = new Set(["thetradescout.com", "www.thetradescout.com"]);
export const DISCOVERY_ATTRIBUTION_HANDOFF_PARAM = "ts_discovery";

/**
 * Carries the existing signed discovery identity to the canonical pre-scout
 * flow when a public profile is served on its custom domain. The token is
 * appended only to a same-host or canonical TradeScout pre-scout URL, so it
 * cannot be leaked through arbitrary destinations.
 */
export function appendDiscoveryAttributionHandoff(href: string): string {
  if (typeof window === "undefined") return href;
  const token = readPublishedDiscoveryAttributionToken();
  if (!token) return href;

  try {
    const raw = String(href || "").trim();
    if (!raw || raw.startsWith("//")) return href;
    const target = new URL(raw, window.location.origin);
    const targetHost = target.hostname.toLowerCase();
    const currentHost = window.location.hostname.toLowerCase();
    const isAllowedHost = targetHost === currentHost || PRIMARY_TRADESCOUT_HOSTS.has(targetHost);
    if (
      !isAllowedHost ||
      (target.protocol !== "https:" && target.protocol !== "http:") ||
      target.pathname !== "/pre-scout-setup"
    ) {
      return href;
    }

    target.searchParams.set(DISCOVERY_ATTRIBUTION_HANDOFF_PARAM, token);
    if (/^https?:\/\//i.test(raw)) return target.toString();
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return href;
  }
}

export { DISCOVERY_LANDING_EVENT };
