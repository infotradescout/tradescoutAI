import { USER_TYPE_BADGES } from "../shared/userTypes";
import { db } from "./db";
import {
  canonicalizeProfessionalRole,
  updateUserPreservingApprovedProfessionalRoles,
} from "./services/professionalRoleAuthority";

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
  const builderBadgeLabel = USER_TYPE_BADGES["community_builder"];
  const result = await updateUserPreservingApprovedProfessionalRoles({
    database: db,
    userId,
    buildPatch: ({ currentUser, approvedProfessionalRoles }) => {
      const approvedRoleSet = new Set<string>(approvedProfessionalRoles);
      const existingRoles = Array.isArray(currentUser.roles)
        ? currentUser.roles.filter((role: unknown) => {
            const professionalRole = canonicalizeProfessionalRole(role);
            if (!professionalRole) return typeof role === "string";
            return (
              professionalRole !== "car_salesman" &&
              professionalRole !== "vehicle_dealer" &&
              approvedRoleSet.has(professionalRole)
            );
          })
        : [];
      const roles = Array.from(new Set([...existingRoles, "community_builder"]));
      const existingBadges = Array.isArray(currentUser.badges)
        ? currentUser.badges.filter((badge: unknown): badge is string => typeof badge === "string")
        : [];
      const badges =
        builderBadgeLabel && !existingBadges.includes(builderBadgeLabel)
          ? [...existingBadges, builderBadgeLabel]
          : existingBadges;
      const currentPreferences = (currentUser.preferences as any) || {};

      return {
        roles,
        badges,
        preferences: {
          ...currentPreferences,
          badges: {
            ...(currentPreferences.badges || {}),
            show: true,
          },
        },
        updatedAt: new Date(),
      };
    },
  });

  if (result.outcome === "not_found") return;
  if (result.outcome !== "updated") {
    throw new Error("Community Builder authority projection could not be updated");
  }
}
