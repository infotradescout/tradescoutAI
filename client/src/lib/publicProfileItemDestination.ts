export function qualifyPublicProfileItemDestination(
  destination: string,
  platformBaseHref = ""
): string {
  const base = platformBaseHref.trim().replace(/\/+$/, "");
  if (!base || !destination.startsWith("/") || destination.startsWith("//")) return destination;
  return `${base}${destination}`;
}

export function requiresDocumentNavigation(destination: string): boolean {
  return /^(?:https?:)?\/\//i.test(destination.trim());
}

export function normalizeAffiliateShareDestination(destination: string): string | null {
  const trimmed = destination.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  try {
    const url = new URL(trimmed);
    if (
      url.protocol === "https:" &&
      (url.hostname === "www.thetradescout.com" || url.hostname === "thetradescout.com")
    ) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    // Invalid and non-TradeScout absolute destinations are shared plainly.
  }

  return null;
}
