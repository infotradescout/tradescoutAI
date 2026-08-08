import {
  buildClientDiscoveryLandingPayload,
  DISCOVERY_LANDING_EVENT,
  sanitizeDiscoveryLandingEvent,
} from "@shared/discoveryLanding";
import type { DiscoveryLandingEntityType } from "@shared/discoveryLanding";

let lastDiscoveryLandingKey: string | null = null;
export const DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY = "tradescout:discovery-attribution:v1";

export type StoredDiscoveryLandingAttribution = {
  businessSlug: string;
  entryRequestId: string;
};

function readEntryRequestId(): string | null {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector('meta[name="tradescout-entry-request-id"]')?.getAttribute("content") ??
    null
  );
}

function readMeta(name: string): string | null {
  if (typeof document === "undefined") return null;
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") || null;
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
    const businessSlug = String(parsed?.businessSlug || "")
      .trim()
      .toLowerCase();
    const entryRequestId = String(parsed?.entryRequestId || "").trim();
    if (
      businessSlug !==
        String(profileSlug || "")
          .trim()
          .toLowerCase() ||
      !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(businessSlug) ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(entryRequestId)
    ) {
      return null;
    }
    return { businessSlug, entryRequestId };
  } catch {
    return null;
  }
}

/** Test helper — clears in-memory once-per-landing dedupe. */
export function resetDiscoveryLandingDedupeForTests(): void {
  lastDiscoveryLandingKey = null;
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
  entryRequestId?: string | null;
}): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;

    const identity = getPublishedDiscoveryIdentity();
    if (!identity) return false;

    const params = new URLSearchParams(
      options.search ?? (typeof window !== "undefined" ? window.location.search : "")
    );
    const raw = buildClientDiscoveryLandingPayload({
      canonicalRoute: options.canonicalRoute,
      businessSlug: identity.businessSlug,
      entityType: identity.entityType,
      searchParams: params,
      referrer:
        options.referrer ?? (typeof document !== "undefined" ? document.referrer || null : null),
      anonymousSessionId: options.anonymousSessionId ?? null,
      entryRequestId: options.entryRequestId ?? readEntryRequestId(),
    });
    const safe = sanitizeDiscoveryLandingEvent(raw);
    if (!safe) return false;

    if (safe.entryRequestId) {
      try {
        window.sessionStorage.setItem(
          DISCOVERY_LANDING_ATTRIBUTION_STORAGE_KEY,
          JSON.stringify({
            businessSlug: safe.businessSlug,
            entryRequestId: safe.entryRequestId,
          })
        );
      } catch {
        // Attribution storage is best-effort and never affects the landing UX.
      }
    }

    const dedupeKey = [
      safe.businessSlug,
      safe.entityType,
      safe.canonicalRoute,
      safe.sourceHint,
      safe.entryRequestId,
    ]
      .map((value) => String(value || ""))
      .join("|");
    if (lastDiscoveryLandingKey === dedupeKey) return false;
    lastDiscoveryLandingKey = dedupeKey;

    await fetch("/api/analytics/shell", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(safe),
    });
    return true;
  } catch {
    return false;
  }
}

export { DISCOVERY_LANDING_EVENT };
