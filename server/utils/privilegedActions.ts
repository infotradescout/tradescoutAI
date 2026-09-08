import { logAdminAction } from "../services/adminAuditLogService";

const PROTECTED_PRIVILEGED_ROLES = new Set(["moderator", "ops_admin", "super_admin"]);

export function normalizePrivilegedRoleToken(role: unknown): string {
  const raw = String(role || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (raw === "owner" || raw === "head_admin") return "super_admin";
  return raw;
}

export function collectPrivilegedRoles(user: any): string[] {
  if (!user) return [];
  const roles = [
    normalizePrivilegedRoleToken(user.role),
    normalizePrivilegedRoleToken(user.activeRole),
    ...(Array.isArray(user.roles)
      ? user.roles.map((role: unknown) => normalizePrivilegedRoleToken(role))
      : []),
  ].filter(Boolean);
  return Array.from(new Set(roles));
}

export function resolvePrivilegedActor(user: any): {
  actorId: string | null;
  actorRole: string | null;
  actorRoles: string[];
} {
  const actorId = normalizeImmutableTargetId(user?.id || user?.claims?.sub);
  const actorRoles = collectPrivilegedRoles(user);
  return {
    actorId,
    actorRole: actorRoles[0] || null,
    actorRoles,
  };
}

export function actorHasPrivilegedCapability(user: any, allowedRoles: string[]): boolean {
  const roleSet = new Set(collectPrivilegedRoles(user));
  return allowedRoles.some((role) => roleSet.has(normalizePrivilegedRoleToken(role)));
}

export function normalizePrivilegedReason(
  reason: unknown,
  minLength = 12,
  maxLength = 500
): string | null {
  const normalized = String(reason || "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length >= minLength && normalized.length <= maxLength ? normalized : null;
}

export function normalizeImmutableTargetId(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function isProtectedPrivilegedTarget(user: any): boolean {
  const roles = collectPrivilegedRoles(user);
  return roles.some((role) => PROTECTED_PRIVILEGED_ROLES.has(role));
}

export function suppliedEmailMatchesTarget(suppliedEmail: unknown, target: any): boolean {
  const provided = String(suppliedEmail || "")
    .trim()
    .toLowerCase();
  if (!provided) return true;
  const actual = String(target?.email || "")
    .trim()
    .toLowerCase();
  return Boolean(actual) && provided === actual;
}

export async function auditPrivilegedAction(event: {
  action: string;
  route: string;
  operationType: string;
  actorId: string | null;
  actorRole?: string | null;
  actorRoles?: string[];
  targetType?: string;
  targetId?: string | null;
  resolutionSource?: string;
  reason?: string | null;
  outcome: "denied" | "completed" | "started" | "stopped";
  lookupInput?: Record<string, unknown>;
  details?: Record<string, unknown>;
  database?: any;
}) {
  const { database, ...auditEvent } = event;
  await logAdminAction(
    {
      ...auditEvent,
      actorId: event.actorId ?? undefined,
      actorRole: event.actorRole || null,
      actorRoles: Array.isArray(event.actorRoles) ? event.actorRoles : [],
      targetType: event.targetType || null,
      targetId: event.targetId ?? undefined,
      resolutionSource: event.resolutionSource || null,
      reason: event.reason || null,
      lookupInput: event.lookupInput || null,
      details: event.details || null,
    },
    { database }
  );
}

export type BestEffortPrivilegedAuditWarning = {
  code: string;
  message: string;
  retryRequired: true;
};

/**
 * Summary audits happen after independently committed row transactions. A
 * summary failure must remain visible without misreporting durable row work as
 * rolled back.
 */
export async function runBestEffortPrivilegedSummaryAudit(input: {
  write: () => Promise<void>;
  warningCode: string;
  warningMessage: string;
  onError?: (error: unknown) => void;
}): Promise<BestEffortPrivilegedAuditWarning | null> {
  try {
    await input.write();
    return null;
  } catch (error) {
    input.onError?.(error);
    return {
      code: input.warningCode,
      message: input.warningMessage,
      retryRequired: true,
    };
  }
}
