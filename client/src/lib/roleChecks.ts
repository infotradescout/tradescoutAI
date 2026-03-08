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

  const normalizeEmail = (value: unknown): string =>
    typeof value === "string" ? value.trim().toLowerCase() : "";
  const adminAliasEmails = new Set<string>([
    "info.tradescout@gmail.com",
    "contact@thetradescout.com",
  ]);
  const userEmail = normalizeEmail(user.email);
  const claimsEmail = normalizeEmail(user.claims?.email);
  if (
    (userEmail && adminAliasEmails.has(userEmail)) ||
    (claimsEmail && adminAliasEmails.has(claimsEmail))
  ) {
    return true;
  }

  const truthyFlag = (value: unknown): boolean => {
    if (value === true) return true;
    if (typeof value === "string") return value.trim().toLowerCase() === "true";
    return false;
  };

  if (
    truthyFlag(user.isAdmin) ||
    truthyFlag(user.isSuperAdmin) ||
    truthyFlag(user.claims?.isAdmin) ||
    truthyFlag(user.claims?.isSuperAdmin)
  ) {
    return true;
  }

  if (isAdminTier(user.role) || isSuperAdminLike(user.role)) return true;
  if (isAdminTier(user.activeRole) || isSuperAdminLike(user.activeRole)) return true;
  if (isAdminTier(user.claims?.role as UserRole) || isSuperAdminLike(user.claims?.role as UserRole))
    return true;
  if (
    isAdminTier(user.claims?.activeRole as UserRole) ||
    isSuperAdminLike(user.claims?.activeRole as UserRole)
  )
    return true;

  const tokenLooksAdminLike = (rawValue: unknown): boolean => {
    const normalized = normalizeRole(
      typeof rawValue === "string" ? rawValue : String(rawValue || "")
    );
    if (!normalized) return false;
    return (
      isAdminTier(normalized) ||
      isSuperAdminLike(normalized) ||
      normalized.includes("admin") ||
      normalized === "moderator"
    );
  };

  if (tokenLooksAdminLike(user.role) || tokenLooksAdminLike(user.activeRole)) {
    return true;
  }

  const roleCollections: unknown[][] = [];
  if (Array.isArray(user.roles)) roleCollections.push(user.roles);
  if (Array.isArray(user.claims?.roles)) roleCollections.push(user.claims?.roles as unknown[]);

  for (const roleCollection of roleCollections) {
    const hasAdminLikeToken = roleCollection.some((role) => {
      if (tokenLooksAdminLike(role)) return true;
      if (role && typeof role === "object") {
        const obj = role as Record<string, unknown>;
        return (
          tokenLooksAdminLike(obj.role) ||
          tokenLooksAdminLike(obj.name) ||
          tokenLooksAdminLike(obj.value)
        );
      }
      return false;
    });

    if (hasAdminLikeToken) return true;
  }

  return false;
};

/**
 * Staff check (employee moderation access)
 *
 * NOT admin tier. Should not see admin navigation.
 */
export const isModerator = (role: UserRole): boolean => {
  return normalizeRole(role) === "moderator";
};
