import { storage } from "./storage";
import { USER_TYPE_BADGES } from "../shared/userTypes";

export type CommunityBuilderAwardReason =
  | "community_vault_donation"
  | "builder_fund"
  | "affiliate_conversion";

/**
 * Idempotently grant the Community Builder role + badge to a user.
 *
 * - Adds `community_builder` to `roles` if missing.
 * - Ensures the Community Builder badge label is present in `badges`.
 * - Forces `preferences.badges.show = true` so it actually renders.
 */
export async function grantCommunityBuilderBadge(
  userId: string,
  _reason: CommunityBuilderAwardReason
): Promise<void> {
  const user = await storage.getUser(userId);
  if (!user) return;

  // Normalize roles: keep existing primary/active role, just add community_builder to the list.
  const existingRoles = Array.isArray(user.roles)
    ? (user.roles.filter((r: any) => typeof r === "string") as string[])
    : [];

  const roles = existingRoles.includes("community_builder")
    ? existingRoles
    : [...existingRoles, "community_builder"];

  // Normalize badges and add the Community Builder badge label if needed.
  const existingBadges = Array.isArray(user.badges)
    ? (user.badges.filter((b: any) => typeof b === "string") as string[])
    : [];

  const builderBadgeLabel = USER_TYPE_BADGES["community_builder"];
  const badges = builderBadgeLabel && !existingBadges.includes(builderBadgeLabel)
    ? [...existingBadges, builderBadgeLabel]
    : existingBadges;

  // Ensure badge visibility is on.
  const currentPrefs = (user.preferences as any) || {};
  const updatedPreferences = {
    ...currentPrefs,
    badges: {
      ...(currentPrefs.badges || {}),
      show: true,
    },
  };

  await storage.updateUser(userId, {
    roles,
    badges,
    preferences: updatedPreferences as any,
  });
}
