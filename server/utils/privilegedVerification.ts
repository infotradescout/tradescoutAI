import {
  collectAuthorityRoles,
  isAdminTierRole,
  normalizeAuthorityRole,
  resolvePrivilegedVerificationBypass,
} from "./authorityPolicy";

export function hasPrivilegedVerificationBypass(user: any): boolean {
  return resolvePrivilegedVerificationBypass(user).active;
}

export function applyPrivilegedVerificationBypass<T extends Record<string, any> | undefined>(
  user: T
): T {
  const resolution = resolvePrivilegedVerificationBypass(user);
  if (!user || !resolution.active) return user;

  const normalizedRoles = collectAuthorityRoles(user);
  const normalizedPrimaryRole = normalizeAuthorityRole(user.role);
  const primaryRole = normalizedRoles[0] || normalizedPrimaryRole || user.role;
  const isAdminLike = normalizedRoles.some((role) => isAdminTierRole(role));
  const isSuperAdminLike = normalizedRoles.some((role) => role === "super_admin");

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
