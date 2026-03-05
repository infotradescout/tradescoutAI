/**
 * ROLE CHECK AUTHORITY
 *
 * Single source of truth for role-based access checks.
 * Used for navigation visibility, not permissions.
 *
 * RULE: Navigation must be stricter than permissions.
 * If a user can't act, they shouldn't see it.
 */

export type UserRole = string | undefined;

const normalizeRole = (role: UserRole): string => {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!raw) return "";
  if (raw === "owner" || raw === "head_admin") return "super_admin";
  return raw;
};

/**
 * Super Admin check (highest authority tier)
 *
 * Temporary legacy support for head_admin → super_admin transition.
 * DO NOT expand this list.
 */
export const isSuperAdminLike = (role: UserRole): boolean => {
  const normalized = normalizeRole(role);
  return normalized === "super_admin";
};

/**
 * Operations Admin check (platform operations tier)
 *
 * Can access admin tools but not authority-sensitive features.
 */
export const isOpsAdmin = (role: UserRole): boolean => {
  return normalizeRole(role) === "ops_admin";
};

/**
 * Any admin-tier access (super_admin OR ops_admin)
 *
 * Use for features that both admin tiers can access.
 */
export const isAdminTier = (role: UserRole): boolean => {
  return isSuperAdminLike(role) || isOpsAdmin(role);
};

/**
 * Staff check (employee moderation access)
 *
 * NOT admin tier. Should not see admin navigation.
 */
export const isModerator = (role: UserRole): boolean => {
  return normalizeRole(role) === "moderator";
};
