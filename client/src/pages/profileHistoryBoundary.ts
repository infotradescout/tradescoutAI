function historyStateRecord(state: unknown): Record<string, unknown> {
  return state && typeof state === "object" && !Array.isArray(state)
    ? (state as Record<string, unknown>)
    : {};
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
