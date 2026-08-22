import {
  collectAuthorityRoles,
  isAdminTierRole,
  normalizeAuthorityRole,
  resolvePrivilegedVerificationBypass,
} from "./authorityPolicy";

export function hasPrivilegedVerificationBypass(user: any): boolean {
  return resolvePrivilegedVerificationBypass(user).active;
}

type PrivilegedVerificationRequestLike = {
  user?: any;
  session?: unknown;
};

export function hasRequestPrivilegedVerificationBypass(
  req: PrivilegedVerificationRequestLike
): boolean {
  const session =
    req?.session !== null && typeof req?.session === "object"
      ? (req.session as Record<string, unknown>)
      : null;
  const impersonationFields = [
    "isImpersonating",
    "impersonatedUserId",
    "impersonatingRole",
  ] as const;
  const hasImpersonationMarker =
    !!session &&
    impersonationFields.some((field) => Object.prototype.hasOwnProperty.call(session, field));

  if (!hasImpersonationMarker) {
    return hasPrivilegedVerificationBypass(req?.user);
  }

  const impersonatedUserId = session?.impersonatedUserId;
  const impersonatingRole = session?.impersonatingRole;
  if (
    session?.isImpersonating !== true ||
    typeof impersonatedUserId !== "string" ||
    impersonatedUserId.trim().length === 0 ||
    typeof impersonatingRole !== "string" ||
    impersonatingRole.trim().length === 0
  ) {
    return false;
  }

  const effectiveRole = impersonatingRole.trim();
  return hasPrivilegedVerificationBypass({
    role: effectiveRole,
    activeRole: effectiveRole,
    roles: [effectiveRole],
  });
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
