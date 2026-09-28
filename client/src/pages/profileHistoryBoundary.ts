function historyStateRecord(state: unknown): Record<string, unknown> {
  return state && typeof state === "object" && !Array.isArray(state)
    ? (state as Record<string, unknown>)
    : {};
}

// An in-app profile link already has a browser-history entry to return to.
// Keep this marker in live tab memory only; a direct visit, reload, or new tab
// must continue to use the external-entry safety boundary.
const IN_APP_PROFILE_NAVIGATION_WINDOW_MS = 60_000;
let recentInAppProfileNavigation: { path: string; expiresAt: number } | null = null;

export function rememberInAppProfileNavigation(path: string, now = Date.now()): boolean {
  if (!/^\/u\/[a-z0-9][a-z0-9-]{0,119}$/i.test(path)) return false;
  recentInAppProfileNavigation = {
    path,
    expiresAt: now + IN_APP_PROFILE_NAVIGATION_WINDOW_MS,
  };
  return true;
}

export function hasRecentInAppProfileNavigation(path: string, now = Date.now()): boolean {
  if (recentInAppProfileNavigation && now > recentInAppProfileNavigation.expiresAt) {
    recentInAppProfileNavigation = null;
  }
  return recentInAppProfileNavigation?.path === path;
}

export function createProfileHistoryBoundaryState(
  state: unknown,
  boundaryKey: string,
  profileSlug: string
): Record<string, unknown> {
  return {
    ...historyStateRecord(state),
    [boundaryKey]: profileSlug,
  };
}

export function isProfileHistoryBoundaryState(
  state: unknown,
  boundaryKey: string,
  profileSlug: string
): boolean {
  return historyStateRecord(state)[boundaryKey] === profileSlug;
}
