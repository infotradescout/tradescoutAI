export function isProfileVisibilityPublic(args: {
  profileId: unknown;
  preferences: unknown;
}): boolean {
  const preferences =
    args.preferences && typeof args.preferences === "object" && !Array.isArray(args.preferences)
      ? (args.preferences as Record<string, unknown>)
      : {};
  if (
    String(preferences.profileVisibility || "")
      .trim()
      .toLowerCase() === "public"
  ) {
    return true;
  }

  const profileId = String(args.profileId || "").trim();
  if (!profileId || !Array.isArray(preferences.publicProfileIds)) return false;
  return preferences.publicProfileIds.some((value) => String(value || "").trim() === profileId);
}
