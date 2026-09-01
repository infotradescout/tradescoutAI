import {
  collectAuthorityRoles,
  isPrivilegedOrAdminRoleToken,
  isReservedSignupIdentityEmail,
} from "../utils/authorityPolicy";
import { actorHasPrivilegedCapability } from "../utils/privilegedActions";

export type AdminQuickUserControlDecision =
  | {
      outcome: "allowed";
      actorIsSuperAdmin: boolean;
      targetIsProtected: boolean;
    }
  | {
      outcome: "denied";
      code: string;
      message: string;
    };

/**
 * Shared fail-closed policy for the mounted admin quick controls. Callers must
 * evaluate it against rows locked in the same transaction as the mutation.
 */
export function evaluateAdminQuickUserControl(input: {
  actor: any;
  actorId: string;
  target: any;
  targetUserId: string;
  requestedRoles?: readonly unknown[];
}): AdminQuickUserControlDecision {
  const actorIsSuperAdmin = actorHasPrivilegedCapability(input.actor, ["super_admin"]);
  const actorIsOpsAdmin = actorHasPrivilegedCapability(input.actor, ["ops_admin"]);
  if (!actorIsSuperAdmin && !actorIsOpsAdmin) {
    return {
      outcome: "denied",
      code: "QUICK_CONTROL_AUTHORITY_REQUIRED",
      message: "Ops admin or super admin authority is required.",
    };
  }
  if (input.actorId === input.targetUserId) {
    return {
      outcome: "denied",
      code: "SELF_QUICK_CONTROL_FORBIDDEN",
      message: "Administrators cannot use quick controls on their own account.",
    };
  }

  const targetIsProtected =
    collectAuthorityRoles(input.target).some((role) => isPrivilegedOrAdminRoleToken(role)) ||
    isReservedSignupIdentityEmail(input.target?.email);
  const requestsProtectedAuthority = (input.requestedRoles || []).some((role) =>
    isPrivilegedOrAdminRoleToken(role)
  );

  if (!actorIsSuperAdmin && requestsProtectedAuthority) {
    return {
      outcome: "denied",
      code: "SUPER_ADMIN_ASSIGNMENT_REQUIRED",
      message: "Only a super admin may assign a protected or staff role.",
    };
  }
  if (!actorIsSuperAdmin && targetIsProtected) {
    return {
      outcome: "denied",
      code: "SUPER_ADMIN_TARGET_REQUIRED",
      message: "Only a super admin may modify a protected account.",
    };
  }

  return { outcome: "allowed", actorIsSuperAdmin, targetIsProtected };
}
