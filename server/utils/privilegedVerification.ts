const ADMIN_ROLES = new Set(["moderator", "ops_admin", "super_admin", "head_admin"]);
const STAFF_OR_ADMIN_ROLES = new Set([
  "support_agent",
  "content_moderator",
  "territory_manager",
  "contractor_success",
  "content_seo",
  "analytics_specialist",
  "marketing_specialist",
  "moderator",
  "ops_admin",
  "super_admin",
  "head_admin",
]);

function normalizeRole(role: unknown): string {
  const raw = typeof role === "string" ? role.trim().toLowerCase() : "";
  if (!raw) return "";
  return raw === "owner" ? "head_admin" : raw;
}

function normalizedRolesForUser(user: any): string[] {
  const primaryRole = normalizeRole(user?.role);
  const activeRole = normalizeRole(user?.activeRole);
  const roleList = Array.isArray(user?.roles) ? user.roles : [];
  const normalizedRoleList = roleList
    .map((role: unknown) => normalizeRole(role))
    .filter((role: string) => role.length > 0);

  return Array.from(new Set([primaryRole, activeRole, ...normalizedRoleList].filter(Boolean)));
}

export function hasPrivilegedVerificationBypass(user: any): boolean {
  if (!user) return false;
  if (user.isAdmin === true || user.isSuperAdmin === true) return true;
  const roles = normalizedRolesForUser(user);
  return roles.some((role) => STAFF_OR_ADMIN_ROLES.has(role));
}

export function applyPrivilegedVerificationBypass<T extends Record<string, any> | undefined>(
  user: T
): T {
  if (!user || !hasPrivilegedVerificationBypass(user)) return user;

  const normalizedRoles = normalizedRolesForUser(user);
  const primaryRole = normalizedRoles[0] || normalizeRole(user.role) || user.role;
  const isAdminLike = normalizedRoles.some((role) => ADMIN_ROLES.has(role));
  const isSuperAdminLike = normalizedRoles.some(
    (role) => role === "super_admin" || role === "head_admin"
  );

  return {
    ...user,
    role: primaryRole,
    roles: normalizedRoles.length > 0 ? normalizedRoles : user.roles,
    isAdmin: user.isAdmin === true || isAdminLike,
    isSuperAdmin: user.isSuperAdmin === true || isSuperAdminLike,
    emailVerified: true,
    addressVerified: true,
    verificationStatus: "approved",
    licenseVerified: true,
    insuranceVerified: true,
    identityVerified: true,
    taxIdVerified: true,
    bankAccountVerified: true,
  } as T;
}
