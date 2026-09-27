const TRADESCOUT_DOMAIN = "thetradescout.com";

// These labels belong to the platform or to separately governed systems.
// Reserving a hostname does not put that system in the original free-tool set.
const RESERVED_PROFILE_HOST_LABELS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "auth",
  "assets",
  "cdn",
  "mail",
  "support",
  "status",
  "exchange",
  "direct-connect",
  "scout",
  "tools",
  "stonebid",
  "mealscout",
  "sway",
]);

/** Only a TradeScout operator can activate this host for a public profile. */
export function buildTradeScoutHostedProfileDomain(slug: unknown): string | null {
  const label = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (
    label.length < 2 ||
    label.length > 63 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label) ||
    RESERVED_PROFILE_HOST_LABELS.has(label)
  ) {
    return null;
  }
  return `${label}.${TRADESCOUT_DOMAIN}`;
}

/** Public-domain self-service must never claim TradeScout's own host namespace. */
export function isTradeScoutOwnedDomain(domain: unknown): boolean {
  const host = typeof domain === "string" ? domain.trim().toLowerCase().replace(/\.$/, "") : "";
  return host === TRADESCOUT_DOMAIN || host.endsWith(`.${TRADESCOUT_DOMAIN}`);
}
