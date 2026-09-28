const INTERNAL_ORIGIN = "https://tradescout.internal";

function parseInternalPath(value: unknown): URL | null {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 2_048 ||
      /[\\\u0000-\u001f\u007f]/.test(path)) return null;
  try {
    const parsed = new URL(path, INTERNAL_ORIGIN);
    // A normalized or encoded route must not invent a company continuation.
    if (parsed.origin !== INTERNAL_ORIGIN || path.split(/[?#]/, 1)[0] !== parsed.pathname) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isCompanyPage(parsed: URL): boolean {
  // These are public company surfaces, not general application/API routes.
  // Matching a route never grants account, pricing, or contact authority.
  return /^(?:\/(?:u|p)\/[a-z0-9]+(?:-[a-z0-9]+)*|\/jw-stone)(?:\/(?:stones|materials)\/[a-z0-9]+(?:-[a-z0-9]+)*)?\/?$/.test(parsed.pathname);
}

/** Company sign-in/recovery returns do not opt a visitor into the full platform. */
export function isProfileSurfaceContinuation(value: unknown): boolean {
  const parsed = parseInternalPath(value);
  if (!parsed) return false;
  if (isCompanyPage(parsed)) return true;
  // Preserve delivered recovery/verification destinations, without allowing
  // arbitrary next= parameters on application routes to bypass onboarding.
  if (!/^\/(?:check-email|verify-email|reset-password)\/?$/.test(parsed.pathname) ||
      parsed.searchParams.getAll("next").length !== 1) return false;
  const next = parseInternalPath(parsed.searchParams.get("next"));
  return Boolean(next && isCompanyPage(next));
}

/** An optional link, never an automatic redirect or a second registration. */
export function profileTradeScoutOptInPath(): string {
  return "/pre-scout-setup?mode=signin&next=%2Fscout";
}
