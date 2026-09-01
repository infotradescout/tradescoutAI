import {
  collectAuthorityRoles,
  isPrivilegedOrAdminRoleToken,
  isReservedSignupIdentityEmail,
} from "../utils/authorityPolicy";
import { requestedProfessionalRole } from "./professionalRoleAuthority";
import { actorHasPrivilegedCapability } from "../utils/privilegedActions";

export type ImportedDirectoryArchiveDecision =
  | { outcome: "allowed" }
  | { outcome: "denied"; status: number; code: string; message: string };

export function evaluateImportedDirectoryArchiveVerificationState(
  target: any
): ImportedDirectoryArchiveDecision {
  if (
    target?.verificationStatus === "pending" &&
    target?.addressVerified === false &&
    target?.verifiedBadge === false
  ) {
    return { outcome: "allowed" };
  }

  return {
    outcome: "denied",
    status: 409,
    code: "IMPORT_ARCHIVE_VERIFICATION_STATE_PRESENT",
    message: "Accounts with verification state or badges cannot be archived as import residue.",
  };
}

export function evaluateImportedDirectoryArchiveAuthority(input: {
  actor: any;
  actorId: string;
  target: any;
  targetUserId: string;
  originalOrCurrentEmail: string;
}): ImportedDirectoryArchiveDecision {
  if (!actorHasPrivilegedCapability(input.actor, ["ops_admin", "super_admin"])) {
    return {
      outcome: "denied",
      status: 403,
      code: "IMPORT_ARCHIVE_AUTHORITY_REQUIRED",
      message: "Ops admin access required",
    };
  }
  if (input.actorId === input.targetUserId) {
    return {
      outcome: "denied",
      status: 400,
      code: "IMPORT_ARCHIVE_SELF_TARGET_FORBIDDEN",
      message: "Cannot archive your own account",
    };
  }

  const authorityValues = collectAuthorityRoles(input.target);
  const targetIsProtected =
    authorityValues.some((role) => isPrivilegedOrAdminRoleToken(role)) ||
    Boolean(requestedProfessionalRole(authorityValues)) ||
    isReservedSignupIdentityEmail(input.originalOrCurrentEmail);
  if (targetIsProtected) {
    return {
      outcome: "denied",
      status: 409,
      code: "IMPORT_ARCHIVE_TARGET_PROTECTED",
      message: "Protected, privileged, and professional accounts cannot be archived.",
    };
  }
  return { outcome: "allowed" };
}

export function evaluateImportedDirectoryBusinessCardinality(
  ownedBusinessCount: number
): ImportedDirectoryArchiveDecision {
  if (ownedBusinessCount === 1) return { outcome: "allowed" };
  return {
    outcome: "denied",
    status: 409,
    code: "IMPORT_ARCHIVE_BUSINESS_CARDINALITY_MISMATCH",
    message: "Imported directory accounts must own exactly one business to be archived.",
  };
}
