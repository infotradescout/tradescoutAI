import { DEFAULT_LANDING } from "@/lib/postOnboardingRoute";

export type DefaultHomePage =
  | "llm"
  | "marketplace"
  | "contractor-board"
  | "dashboard"
  | "profile"
  | "community";

export function isDefaultHomePage(value: unknown): value is DefaultHomePage {
  return (
    value === "llm" ||
    value === "marketplace" ||
    value === "contractor-board" ||
    value === "dashboard" ||
    value === "profile" ||
    value === "community"
  );
}

/**
 * Resolve a stored defaultHomePage preference to an app route.
 *
 * Note: we keep the stored key `marketplace` for back-compat but
 * route users into the modern Exchange surface.
 */
export function resolveDefaultHomeRoute(page?: DefaultHomePage | null): string {
  if (!page) return DEFAULT_LANDING;

  const map: Record<DefaultHomePage, string> = {
    llm: "/scout",
    marketplace: "/exchange",
    "contractor-board": "/contractors/board",
    dashboard: DEFAULT_LANDING,
    profile: "/profile",
    community: "/community-feed",
  };

  return map[page] ?? DEFAULT_LANDING;
}

export function resolveAuthenticatedHomeRedirect({
  location,
  isCustomDomainProfileRoute,
  communityFirst,
  defaultHomePage,
}: {
  location: string;
  isCustomDomainProfileRoute: boolean;
  communityFirst?: boolean;
  defaultHomePage?: unknown;
}): string | null {
  if (location !== "/" || isCustomDomainProfileRoute) return null;
  if (communityFirst) return "/community-feed";
  if (!defaultHomePage) return null;

  return resolveDefaultHomeRoute(isDefaultHomePage(defaultHomePage) ? defaultHomePage : null);
}
