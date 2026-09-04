import {
  collectAuthorityRoles,
  isPrivilegedOrAdminRoleToken,
  isReservedSignupIdentityEmail,
} from "../utils/authorityPolicy";
import { actorHasPrivilegedCapability } from "../utils/privilegedActions";
import { requestedProfessionalRole } from "./professionalRoleAuthority";

export const REAL_ACCOUNT_IMPORT_CONFIRMATION = "CREATE_USERS";

export async function executeImportedOwnerProjectionAtomically<TResult>(input: {
  database: { transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> };
  project: (tx: any) => Promise<TResult>;
}): Promise<TResult> {
  return input.database.transaction((tx) => input.project(tx));
}

export type AdminBusinessImportDecision =
  | { outcome: "allowed" }
  | { outcome: "denied"; status: number; code: string; message: string };

export type PostCommitClaimWriteWarning = {
  code: "POST_COMMIT_CLAIM_WRITE_FAILED";
  message: string;
  retryRequired: true;
};

function normalizeImportEmail(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function evaluateLockedAdminBusinessImportTarget(input: {
  inputEmail: string;
  lockedUser?: any;
  hasProfessionalApplication: boolean;
}): AdminBusinessImportDecision {
  if (
    input.lockedUser &&
    normalizeImportEmail(input.lockedUser.email) !== normalizeImportEmail(input.inputEmail)
  ) {
    return {
      outcome: "denied",
      status: 409,
      code: "REAL_ACCOUNT_IMPORT_STALE_IDENTITY",
      message: "The target email changed while the import was acquiring authority locks.",
    };
  }

  return evaluateAdminBusinessImportTarget({
    email: input.inputEmail,
    existingUser: input.lockedUser,
    hasProfessionalApplication: input.hasProfessionalApplication,
  });
}

export function resolvePostCommitClaimWriteWarning(input: {
  result?: { success?: boolean; error?: string; reason?: string } | null;
  error?: unknown;
}): PostCommitClaimWriteWarning | null {
  if (!input.error && input.result?.success === true) return null;

  const detail = input.error
    ? input.error instanceof Error
      ? input.error.message
      : String(input.error)
    : input.result?.error || input.result?.reason || "claim write returned an unsuccessful result";

  return {
    code: "POST_COMMIT_CLAIM_WRITE_FAILED",
    message: `Account projection committed, but its claim event needs retry: ${detail}`,
    retryRequired: true,
  };
}

export function evaluateAdminBusinessImportRequest(input: {
  actor: any;
  createOwnerAccountsRequested: boolean;
  confirmation: string;
  reason: string | null;
}): AdminBusinessImportDecision {
  const actorIsSuper = actorHasPrivilegedCapability(input.actor, ["super_admin"]);
  const actorIsOps = actorHasPrivilegedCapability(input.actor, ["ops_admin"]);
  if (!actorIsSuper && !actorIsOps) {
    return {
      outcome: "denied",
      status: 403,
      code: "BUSINESS_IMPORT_AUTHORITY_REQUIRED",
      message: "Ops admin or super admin authority is required.",
    };
  }
  if (!input.createOwnerAccountsRequested) return { outcome: "allowed" };
  if (!actorIsSuper) {
    return {
      outcome: "denied",
      status: 403,
      code: "REAL_ACCOUNT_IMPORT_SUPER_ADMIN_REQUIRED",
      message: "Only a super admin may create real accounts through a bulk import.",
    };
  }
  if (input.confirmation !== REAL_ACCOUNT_IMPORT_CONFIRMATION) {
    return {
      outcome: "denied",
      status: 400,
      code: "REAL_ACCOUNT_IMPORT_CONFIRMATION_REQUIRED",
      message: `Type ${REAL_ACCOUNT_IMPORT_CONFIRMATION} to create real user accounts.`,
    };
  }
  if (!input.reason) {
    return {
      outcome: "denied",
      status: 400,
      code: "REAL_ACCOUNT_IMPORT_REASON_REQUIRED",
      message: "A 12-500 character audit reason is required to create real accounts.",
    };
  }
  return { outcome: "allowed" };
}

export function evaluateAdminBusinessImportTarget(input: {
  email: string;
  existingUser?: any;
  hasProfessionalApplication?: boolean;
}): AdminBusinessImportDecision {
  if (isReservedSignupIdentityEmail(input.email)) {
    return {
      outcome: "denied",
      status: 409,
      code: "REAL_ACCOUNT_IMPORT_RESERVED_IDENTITY",
      message: "Reserved service and recovery identities cannot be imported as user accounts.",
    };
  }
  if (!input.existingUser && !input.hasProfessionalApplication) return { outcome: "allowed" };

  const authorityRoles = collectAuthorityRoles(input.existingUser);
  if (
    input.hasProfessionalApplication === true ||
    authorityRoles.some((role) => isPrivilegedOrAdminRoleToken(role)) ||
    Boolean(requestedProfessionalRole(authorityRoles)) ||
    isReservedSignupIdentityEmail(input.existingUser.email)
  ) {
    return {
      outcome: "denied",
      status: 409,
      code: "REAL_ACCOUNT_IMPORT_TARGET_PROTECTED",
      message: "Bulk import cannot modify protected, privileged, or professional accounts.",
    };
  }
  return { outcome: "allowed" };
}
