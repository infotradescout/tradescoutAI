function preferenceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Exact per-profile release authority. Account-wide profile visibility is not
 * anonymous publication authority because one account can own personal,
 * business, review, and internal profiles at the same time.
 */
export function isProfileExplicitlyPublic(args: {
  profileId: unknown;
  preferences: unknown;
}): boolean {
  const preferences = preferenceRecord(args.preferences);
  const profileId = String(args.profileId || "").trim();
  if (!profileId || !Array.isArray(preferences.publicProfileIds)) return false;
  return preferences.publicProfileIds.some((value) => String(value || "").trim() === profileId);
}

/**
 * Kept as the canonical public-profile helper for existing callers. It now
 * means exactly this profile was released, never that the owner's account was
 * broadly marked public.
 */
export function isProfileVisibilityPublic(args: {
  profileId: unknown;
  preferences: unknown;
}): boolean {
  return isProfileExplicitlyPublic(args);
}
