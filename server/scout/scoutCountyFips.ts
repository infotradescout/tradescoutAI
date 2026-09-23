/** A county label is display text, never a database county key. */
export function normalizeScoutCountyFips(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const value = candidate.trim();
    if (/^\d{5}$/.test(value)) return value;
  }
  return null;
}

/** Local discovery results change; replaying a cached narrative can hide new posts. */
export function requiresFreshScoutDiscovery(message: string): boolean {
  const text = String(message || "").toLowerCase();
  return (
    /\b(search|find|show|look)\b/.test(text) &&
    /\b(tradescout|site|local|near me|my area|my county)\b/.test(text) &&
    /\b(posts?|deals?|requests?|activity)\b/.test(text)
  );
}

/** The partial recovery is only for explicit, multi-surface local discovery. */
export function isMixedScoutDiscoveryRequest(message: string): boolean {
  const value = String(message || "").toLowerCase();
  return (
    requiresFreshScoutDiscovery(value) &&
    /\bposts?\b/.test(value) &&
    /\bdeals?\b/.test(value) &&
    /\b(pages?|tools?|requests?)\b/.test(value)
  );
}
