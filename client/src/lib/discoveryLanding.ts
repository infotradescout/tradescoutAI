import {
  buildClientDiscoveryLandingPayload,
  DISCOVERY_LANDING_EVENT,
  normalizeDiscoveryAttributionToken,
} from "@shared/discoveryLanding";
import type { DiscoveryLandingEntityType } from "@shared/discoveryLanding";

let lastDiscoveryLandingKey: string | null = null;
let fallbackDiscoverySessionId: string | null = null;
export const DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY = "tradescout:discovery-attribution:v1";
export const DISCOVERY_LANDING_SESSION_STORAGE_KEY = "tradescout:discovery-session:v1";

export type StoredDiscoveryLandingAttribution = {
  discoveryAttributionToken: string;
  businessSlug: string;
};

function readDiscoveryAttributionToken(): string | null {
  if (typeof document === "undefined") return null;
  return (
    normalizeDiscoveryAttributionToken(
      document
        .querySelector('meta[name="tradescout-discovery-attribution"]')
        ?.getAttribute("content")
    ) ?? null
  );
}

function readMeta(name: string): string | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") || null;
}

function createDiscoverySessionId(): string {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  return `discovery-${randomPart}`;
}

export function getOrCreateDiscoveryAnonymousSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = String(
      window.sessionStorage.getItem(DISCOVERY_LANDING_SESSION_STORAGE_KEY) || ""
    ).trim();
    if (stored && stored.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(stored)) return stored;

    const created = createDiscoverySessionId();
    window.sessionStorage.setItem(DISCOVERY_LANDING_SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    fallbackDiscoverySessionId ||= createDiscoverySessionId();
    return fallbackDiscoverySessionId;
  }
}

export function getPublishedDiscoveryIdentity(): {
  businessSlug: string;
  entityType: DiscoveryLandingEntityType;
} | null {
  const businessSlug = String(readMeta("tradescout-business-slug") || "")
    .trim()
    .toLowerCase();
  const entityType = String(readMeta("tradescout-business-entity-type") || "").trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(businessSlug)) return null;
  if (entityType !== "business_profile" && entityType !== "business_marketplace") return null;
  return { businessSlug, entityType };
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
    const storedBusinessSlug = String(parsed?.businessSlug || "")
      .trim()
      .toLowerCase();
    const expectedBusinessSlug = String(profileSlug || "")
      .trim()
      .toLowerCase();
    return discoveryAttributionToken &&
      storedBusinessSlug &&
      storedBusinessSlug === expectedBusinessSlug
      ? { discoveryAttributionToken, businessSlug: storedBusinessSlug }
      : null;
  } catch {
    return null;
  }
}

/** Test helper - clears in-memory once-per-landing dedupe. */
export function resetDiscoveryLandingDedupeForTests(): void {
  lastDiscoveryLandingKey = null;
  fallbackDiscoverySessionId = null;
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
    const discoveryAttributionToken = readDiscoveryAttributionToken();
    if (!identity || !discoveryAttributionToken) return false;

    const params = new URLSearchParams(
      options.search ?? (typeof window !== "undefined" ? window.location.search : "")
    );
    const raw = buildClientDiscoveryLandingPayload({
      canonicalRoute: options.canonicalRoute,
      businessSlug: identity.businessSlug,
      entityType: identity.entityType,
      discoveryAttributionToken,
      searchParams: params,
      referrer:
        options.referrer ?? (typeof document !== "undefined" ? document.referrer || null : null),
      anonymousSessionId:
        options.anonymousSessionId ?? getOrCreateDiscoveryAnonymousSessionId() ?? null,
    });
    if (!raw.discoveryAttributionToken) return false;

    try {
      window.sessionStorage.setItem(
        DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY,
        JSON.stringify({
          discoveryAttributionToken: raw.discoveryAttributionToken,
          businessSlug: identity.businessSlug,
        })
      );
    } catch {
      // Attribution storage is best-effort and never affects the landing UX.
    }

    const dedupeKey = [
      raw.discoveryAttributionToken,
      raw.canonicalRoute,
      raw.sourceHint,
      raw.referrerHost,
    ]
      .map((value) => String(value || ""))
      .join("|");
    if (lastDiscoveryLandingKey === dedupeKey) return false;
    lastDiscoveryLandingKey = dedupeKey;

    await fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(raw.anonymousSessionId
          ? { "X-Anonymous-Session-Id": String(raw.anonymousSessionId) }
          : {}),
      },
      body: JSON.stringify(raw),
    });
    return true;
  } catch {
    return false;
  }
}

export { DISCOVERY_LANDING_EVENT };
