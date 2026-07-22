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

function shortAffiliateHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    const character = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ character, 2654435761);
    h2 = Math.imul(h2 ^ character, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function buildAffiliateShareSlug(userId: string, absoluteDestination: string): string {
  return `s-${shortAffiliateHash(`${userId}:${absoluteDestination}`)}`;
}
