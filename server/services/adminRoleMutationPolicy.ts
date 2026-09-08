import { userRoleEnum } from "@shared/schema";
import { requestedProfessionalRole } from "./professionalRoleAuthority";
import {
  collectAuthorityRoles,
  isPrivilegedOrAdminRoleToken,
  isReservedSignupIdentityEmail,
} from "../utils/authorityPolicy";
import { actorHasPrivilegedCapability } from "../utils/privilegedActions";

export const ADMIN_ROLE_MUTATION_CONFIRMATION = "I UNDERSTAND THIS EDIT IS AUDITED";

const DISALLOWED_GENERIC_ROLE_VALUES = new Set(["admin", "head_admin"]);

export const ADMIN_MULTI_ROLE_ALLOWED_VALUES: ReadonlySet<string> = new Set(
  userRoleEnum.enumValues.filter(
    (role) =>
      !DISALLOWED_GENERIC_ROLE_VALUES.has(role) && role !== "realtor" && role !== "car_dealer"
  )
);

export type ParsedAdminRoleMutation =
  | {
      outcome: "allowed";
      roles: string[];
      activeRole: string;
      includesProtectedRole: boolean;
    }
  | {
      outcome: "invalid" | "professional_decision_required";
      code: string;
      message: string;
    };

export function parseAdminRoleMutationRequest(
  rolesValue: unknown,
  activeRoleValue: unknown
): ParsedAdminRoleMutation {
  if (!Array.isArray(rolesValue) || rolesValue.length === 0 || rolesValue.length > 32) {
    return {
      outcome: "invalid",
      code: "INVALID_ROLE_ARRAY",
      message: "Roles must be a non-empty array of at most 32 canonical role values.",
    };
  }
  if (rolesValue.some((role) => typeof role !== "string")) {
    return {
      outcome: "invalid",
      code: "INVALID_ROLE_VALUE",
      message: "Every role must be a canonical string value.",
    };
  }

  const professionalRole = requestedProfessionalRole([...rolesValue, activeRoleValue]);
  if (professionalRole) {
    return {
      outcome: "professional_decision_required",
      code: "PROFESSIONAL_VERIFICATION_DECISION_REQUIRED",
      message: "Professional roles must be managed through verification decisions.",
    };
  }

  const roles = Array.from(
    new Set(rolesValue.map((role) => String(role).trim().toLowerCase()).filter(Boolean))
  );
  const activeRole =
    typeof activeRoleValue === "string" ? activeRoleValue.trim().toLowerCase() : "";
  if (
    roles.length === 0 ||
    roles.some((role) => !ADMIN_MULTI_ROLE_ALLOWED_VALUES.has(role)) ||
    !ADMIN_MULTI_ROLE_ALLOWED_VALUES.has(activeRole)
  ) {
    return {
      outcome: "invalid",
      code: "ROLE_NOT_ALLOWED",
      message: "One or more roles are not allowed by the admin multi-role policy.",
    };
  }
  if (!roles.includes(activeRole)) {
    return {
      outcome: "invalid",
      code: "ACTIVE_ROLE_NOT_ASSIGNED",
      message: "Active role must be one of the assigned roles.",
    };
  }

  return {
    outcome: "allowed",
    roles,
    activeRole,
    includesProtectedRole: roles.some((role) => isPrivilegedOrAdminRoleToken(role)),
  };
}

export type AdminRoleMutationAuthorityDecision =
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

export function evaluateAdminRoleMutationAuthority(input: {
  actor: any;
  actorId: string;
  target: any;
  targetUserId: string;
  requestedRoles: readonly string[];
}): AdminRoleMutationAuthorityDecision {
  const actorIsSuperAdmin = actorHasPrivilegedCapability(input.actor, ["super_admin"]);
  const actorIsOpsAdmin = actorHasPrivilegedCapability(input.actor, ["ops_admin"]);
  if (!actorIsSuperAdmin && !actorIsOpsAdmin) {
    return {
      outcome: "denied",
      code: "ROLE_MUTATION_AUTHORITY_REQUIRED",
      message: "Ops admin or super admin authority is required.",
    };
  }
  if (input.actorId === input.targetUserId) {
    return {
      outcome: "denied",
      code: "SELF_ROLE_MUTATION_FORBIDDEN",
      message: "Administrators cannot modify their own authority roles.",
    };
  }

  const targetRoles = collectAuthorityRoles(input.target);
  const targetIsProtected =
    targetRoles.some((role) => isPrivilegedOrAdminRoleToken(role)) ||
    isReservedSignupIdentityEmail(input.target?.email);
  const requestedProtectedRole = input.requestedRoles.some((role) =>
    isPrivilegedOrAdminRoleToken(role)
  );

  if (!actorIsSuperAdmin && requestedProtectedRole) {
    return {
      outcome: "denied",
      code: "SUPER_ADMIN_ROLE_ASSIGNMENT_REQUIRED",
      message: "Only a super admin may assign protected or staff roles.",
    };
  }
  if (!actorIsSuperAdmin && targetIsProtected) {
    return {
      outcome: "denied",
      code: "SUPER_ADMIN_TARGET_MUTATION_REQUIRED",
      message: "Only a super admin may modify a protected account.",
    };
  }

  return { outcome: "allowed", actorIsSuperAdmin, targetIsProtected };
}
