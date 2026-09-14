const INTERNAL_ORIGIN = "https://tradescout.internal";

function parseInternalPath(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.length > 2_048 ||
    /[\\\u0000-\u001f\u007f]/.test(path)
  ) {
    return null;
  }
  try {
    const parsed = new URL(path, INTERNAL_ORIGIN);
    // Require the supplied pathname itself to be canonical. Normalizing an
    // encoded or dot-segment route must not grant an onboarding exemption.
    if (parsed.origin !== INTERNAL_ORIGIN || path.split(/[?#]/, 1)[0] !== parsed.pathname) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** A navigation continuation only; publication still requires server authority. */
export function isRecommendationContinuationPath(value: unknown): boolean {
  const parsed = parseInternalPath(value);
  return Boolean(
    parsed &&
    /^\/(?:u|contractors)\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(parsed.pathname) &&
    parsed.searchParams.getAll("trustAction").length === 1 &&
    parsed.searchParams.get("trustAction") === "recommend"
  );
}

export function isRecommendationVerificationPath(value: unknown): boolean {
  const parsed = parseInternalPath(value);
  return Boolean(
    parsed &&
    /^\/verification\/?$/.test(parsed.pathname) &&
    parsed.searchParams.getAll("next").length === 1 &&
    isRecommendationContinuationPath(parsed.searchParams.get("next"))
  );
}

export function isRecommendationActionPath(value: unknown): boolean {
  return isRecommendationContinuationPath(value) || isRecommendationVerificationPath(value);
}
