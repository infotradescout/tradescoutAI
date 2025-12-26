import jwt from 'jsonwebtoken';
import { logAdminAction } from './adminAuditLogService';

const IMPERSONATION_SECRET = process.env.IMPERSONATION_SECRET || 'impersonation_secret';
const IMPERSONATION_TTL = 30 * 60; // 30 minutes

export async function createImpersonationToken(adminId: string, targetUserId: string) {
  // Issue a JWT for impersonation
  await logAdminAction({ type: 'impersonation_start', adminId, targetUserId });
  return jwt.sign({ adminId, targetUserId, impersonating: true }, IMPERSONATION_SECRET, { expiresIn: IMPERSONATION_TTL });
}

  // Invalidate token if using a token blacklist, or rely on TTL
  await logAdminAction({ type: 'impersonation_exit', adminId });
  return true;
}

export async function logImpersonationEvent(event: any) {
  // Log to DB or audit log
  // For now, just a stub
  console.log('Impersonation event:', event);
}
