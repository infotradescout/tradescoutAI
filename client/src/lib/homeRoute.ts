import { DEFAULT_LANDING } from "@/lib/postOnboardingRoute";

export type DefaultHomePage =
  | "llm"
  | "marketplace"
  | "contractor-board"
  | "dashboard"
  | "profile"
  | "community";

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
