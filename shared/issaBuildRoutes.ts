/** Owner-directed addresses. Product pages never replace the business profile. */
export const ISSA_BUILD_PUBLIC_PATH = "/issa-build";
export const ISSA_BUILD_ONYX_PATH = "/issa-build/onyx";
export type IssaBuildPublicPage = "profile" | "onyx";

function pathnameOnly(value: string): string {
  return String(value || "").split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
}

export function resolveIssaBuildPublicPage(pathname: string): IssaBuildPublicPage | null {
  const path = pathnameOnly(pathname);
  if (path === ISSA_BUILD_PUBLIC_PATH) return "profile";
  if (path === ISSA_BUILD_ONYX_PATH) return "onyx";
  return null;
}

/** Preserve referral, request and photo selectors. Never intercept API or editor routes. */
export function resolveIssaBuildCanonicalRedirect(rawUrl: string): string | null {
  if (!rawUrl.startsWith("/") || rawUrl.startsWith("//")) return null;
  const path = pathnameOnly(rawUrl);
  const suffixIndex = rawUrl.search(/[?#]/);
  const suffix = suffixIndex < 0 ? "" : rawUrl.slice(suffixIndex);
  const onyxAliases = new Set([
    "/u/honey-onyx", "/p/honey-onyx",
    "/u/issa-build/categories/onyx", "/p/issa-build/categories/onyx",
    "/u/issa-build/onyx", "/p/issa-build/onyx",
  ]);
  if (onyxAliases.has(path)) return `${ISSA_BUILD_ONYX_PATH}${suffix}`;
  if (path === "/u/issa-build" || path === "/p/issa-build") {
    const query = new URL(rawUrl, "https://www.thetradescout.com").searchParams;
    const productRequest = query.has("stone") || query.get("category") === "onyx";
    return `${productRequest ? ISSA_BUILD_ONYX_PATH : ISSA_BUILD_PUBLIC_PATH}${suffix}`;
  }
  const page = resolveIssaBuildPublicPage(path);
  const target = page === "profile" ? ISSA_BUILD_PUBLIC_PATH : page === "onyx" ? ISSA_BUILD_ONYX_PATH : null;
  return target && `${target}${suffix}` !== rawUrl ? `${target}${suffix}` : null;
}
