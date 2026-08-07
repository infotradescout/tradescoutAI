import {
  buildClientDiscoveryLandingPayload,
  DISCOVERY_LANDING_EVENT,
  sanitizeDiscoveryLandingEvent,
} from "@shared/discoveryLanding";

let lastDiscoveryLandingKey: string | null = null;

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
}): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;

    const params = new URLSearchParams(
      options.search ?? (typeof window !== "undefined" ? window.location.search : "")
    );
    const raw = buildClientDiscoveryLandingPayload({
      canonicalRoute: options.canonicalRoute,
      searchParams: params,
      referrer:
        options.referrer ?? (typeof document !== "undefined" ? document.referrer || null : null),
      anonymousSessionId: options.anonymousSessionId ?? null,
    });
    const safe = sanitizeDiscoveryLandingEvent(raw);
    if (!safe) return false;

    const dedupeKey = `${safe.canonicalRoute}|${String(safe.sourceHint || "")}`;
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
