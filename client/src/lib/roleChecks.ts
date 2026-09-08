/**
 * ROLE CHECK AUTHORITY
 *
 * Single source of truth for role-based access checks.
 * Used for navigation visibility, not permissions.
 *
 * RULE: Navigation must be stricter than permissions.
 * If a user can't act, they shouldn't see it.
 */

import {
  isBusinessProviderRole as isSharedBusinessProviderRole,
  userHasBusinessProviderTools,
} from "@shared/roles";

export type UserRole = string | undefined;

const normalizeRole = (role: UserRole): string => {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!raw) return "";
  const compact = raw.replace(/[\s-]+/g, "_");
  if (compact === "owner" || compact === "head_admin" || compact === "superadmin") {
    return "super_admin";
  }
  return compact;
};

/**
 * Super Admin check (highest authority tier)
 *
 * Temporary legacy support for owner/head_admin -> super_admin transition.
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

export const isBusinessProviderRole = (role: UserRole): boolean => {
  return isSharedBusinessProviderRole(role);
};

type AdminLikeUser = {
  isAdmin?: unknown;
  isSuperAdmin?: unknown;
  role?: UserRole;
  activeRole?: UserRole;
  email?: unknown;
  roles?: unknown;
  claims?: {
    role?: unknown;
    activeRole?: unknown;
    roles?: unknown;
    isAdmin?: unknown;
    isSuperAdmin?: unknown;
    email?: unknown;
  };
};

/**
 * Client-side admin UI visibility check.
 *
 * This preserves legacy boolean flags while honoring the canonical
 * admin role model used elsewhere in the app.
 */
export const hasAdminUiAccess = (user: AdminLikeUser | null | undefined): boolean => {
  if (!user) return false;

  if (user.isAdmin === true || user.isSuperAdmin === true) {
    return true;
  }

  if (isAdminTier(user.role) || isSuperAdminLike(user.role)) return true;
  if (isAdminTier(user.activeRole) || isSuperAdminLike(user.activeRole)) return true;

  const isExplicitAdminRole = (rawValue: unknown): boolean => {
    const normalized = normalizeRole(
      typeof rawValue === "string" ? rawValue : String(rawValue || "")
    );
    if (!normalized) return false;
    return isAdminTier(normalized) || isSuperAdminLike(normalized) || normalized === "moderator";
  };

  if (isExplicitAdminRole(user.role) || isExplicitAdminRole(user.activeRole)) {
    return true;
  }

  if (Array.isArray(user.roles) && user.roles.some((role) => isExplicitAdminRole(role)))
    return true;

  return false;
};

export const hasBusinessProviderToolAccess = (
  user: (AdminLikeUser & { activeRole?: UserRole }) | null | undefined
): boolean => {
  return userHasBusinessProviderTools(user);
};

/**
 * Staff check (employee moderation access)
 *
 * NOT admin tier. Should not see admin navigation.
 */
export const isModerator = (role: UserRole): boolean => {
  return normalizeRole(role) === "moderator";
};
