import jwt from "jsonwebtoken";
import { logAdminAction } from "./adminAuditLogService";

function getImpersonationSecret(): string {
  const secret = String(process.env.IMPERSONATION_SECRET || "").trim();
  if (secret) return secret;
  // Never fall back to a hardcoded secret: if this is used accidentally in prod,
  // tokens become forgeable.
  throw new Error("IMPERSONATION_SECRET is missing");
}

const IMPERSONATION_TTL_SECONDS = 30 * 60; // 30 minutes

export async function createImpersonationToken(adminId: string, targetUserId: string) {
  // Issue a JWT for impersonation
  await logAdminAction({ type: "impersonation_start", adminId, targetUserId });
  return jwt.sign({ adminId, targetUserId, impersonating: true }, getImpersonationSecret(), {
    expiresIn: IMPERSONATION_TTL_SECONDS,
  });
}

export async function endImpersonation(adminId: string) {
  // Invalidate token if using a token blacklist, or rely on TTL
  await logAdminAction({ type: "impersonation_exit", adminId });
  return true;
}

export async function logImpersonationEvent(event: {
  adminId?: string;
  targetUserId?: string;
  action?: string;
  [key: string]: any;
}): Promise<void> {
  const { adminId, targetUserId, action, ...rest } = event;
  await logAdminAction({
    type: action ? `impersonation_${action}` : "impersonation_event",
    adminId,
    targetUserId,
    ...rest,
  });
}
