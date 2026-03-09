import { Router } from "express";
import { requireSuperAdmin } from "../../middleware/requireSuperAdmin";
import {
  createImpersonationToken,
  endImpersonation,
  logImpersonationEvent,
} from "../../services/adminImpersonationService";
import {
  auditPrivilegedAction,
  normalizeImmutableTargetId,
  normalizePrivilegedReason,
  resolvePrivilegedActor,
} from "../../utils/privilegedActions";

const router = Router();

// Start impersonation
router.post("/start/:userId", requireSuperAdmin, async (req, res) => {
  const admin = (req as any).user;
  const actor = resolvePrivilegedActor(admin);
  const adminId = actor.actorId;
  const targetUserId = normalizeImmutableTargetId(req.params.userId);
  const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);
  const ip = req.ip;
  if (!adminId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!targetUserId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }
  if (!reason) {
    return res.status(400).json({ success: false, error: "reason is required (min 12 chars)" });
  }
  try {
    const token = await createImpersonationToken(adminId, targetUserId);
    await logImpersonationEvent({
      adminId,
      targetUserId,
      startedAt: new Date(),
      ip,
      action: "start",
    });
    await auditPrivilegedAction({
      action: "admin_impersonation_token_start",
      route: "/api/admin/impersonation/start/:userId",
      operationType: "impersonation_start",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      actorRoles: actor.actorRoles,
      targetType: "user",
      targetId: targetUserId,
      resolutionSource: "route_param:user_id",
      reason,
      outcome: "started",
      details: { ip },
    });
    res.json({ success: true, token, impersonating: true });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: "Failed to start impersonation",
      requestId: (req as any).requestId || null,
    });
  }
});

// Exit impersonation
router.post("/exit", requireSuperAdmin, async (req, res) => {
  const admin = (req as any).user;
  const actor = resolvePrivilegedActor(admin);
  const adminId = actor.actorId;
  if (!adminId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    await endImpersonation(adminId);
    await logImpersonationEvent({ adminId, endedAt: new Date(), action: "exit" });
    await auditPrivilegedAction({
      action: "admin_impersonation_token_exit",
      route: "/api/admin/impersonation/exit",
      operationType: "impersonation_stop",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      actorRoles: actor.actorRoles,
      targetType: "user",
      targetId: null,
      resolutionSource: "admin_impersonation_session",
      reason: "stop_impersonation",
      outcome: "stopped",
    });
    res.json({ success: true, impersonating: false });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: "Failed to end impersonation",
      requestId: (req as any).requestId || null,
    });
  }
});

export default router;
