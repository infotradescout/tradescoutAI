import {
  collectAuthorityRoles,
  isAdminTierRole,
  normalizeAuthorityRole,
  resolvePrivilegedVerificationBypass,
} from "./authorityPolicy";
import { resolveRequestEffectiveUser, type RequestAuthorityContext } from "./requestEffectiveUser";

export function hasPrivilegedVerificationBypass(user: any): boolean {
  return resolvePrivilegedVerificationBypass(user).active;
}

type PrivilegedVerificationRequestLike = {
  user?: any;
  principalUser?: any;
  session?: unknown;
  requestAuthorityContext?: RequestAuthorityContext;
};

export function hasRequestPrivilegedVerificationBypass(
  req: PrivilegedVerificationRequestLike
): boolean {
  const identity = resolveRequestEffectiveUser(req);
  // Administrative verification exceptions are unavailable while viewing
  // another account, including an account that used to hold an admin role.
  if (!identity.ok || identity.isImpersonating) return false;

  const context = req.requestAuthorityContext;
  if (
    context &&
    (!context.ok || context.isImpersonating || context.effectiveUserId !== identity.effectiveUserId)
  ) {
    return false;
  }

  return hasPrivilegedVerificationBypass(context?.ok ? context.effectiveUser : req?.user);
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
