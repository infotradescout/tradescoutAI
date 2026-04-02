import { Router } from "express";
import { requireSuperAdmin } from "../../middleware/requireSuperAdmin";
import { storage } from "../../storage";
import {
  auditPrivilegedAction,
  normalizeImmutableTargetId,
  normalizePrivilegedReason,
  resolvePrivilegedActor,
} from "../../utils/privilegedActions";

const router = Router();

// Suspend user
router.post("/suspend/:userId", requireSuperAdmin, async (req, res) => {
  const userId = normalizeImmutableTargetId(req.params.userId);
  const actor = resolvePrivilegedActor((req as any).user);
  const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);
  const adminId = actor.actorId;

  if (!adminId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }
  if (!reason) {
    return res.status(400).json({ success: false, error: "reason is required (min 12 chars)" });
  }

  await storage.suspendUser(userId);
  await auditPrivilegedAction({
    action: "admin_user_suspend",
    route: "/api/admin/user-controls/suspend/:userId",
    operationType: "suspend_user",
    actorId: adminId,
    actorRole: actor.actorRole,
    actorRoles: actor.actorRoles,
    targetType: "user",
    targetId: userId,
    resolutionSource: "route_param:user_id",
    reason,
    outcome: "completed",
    details: { verificationStatus: "suspended" },
  });
  res.json({ success: true });
});

// Unsuspend user
router.post("/unsuspend/:userId", requireSuperAdmin, async (req, res) => {
  const userId = normalizeImmutableTargetId(req.params.userId);
  const actor = resolvePrivilegedActor((req as any).user);
  const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);
  const adminId = actor.actorId;

  if (!adminId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }
  if (!reason) {
    return res.status(400).json({ success: false, error: "reason is required (min 12 chars)" });
  }

  await storage.unsuspendUser(userId);
  await auditPrivilegedAction({
    action: "admin_user_unsuspend",
    route: "/api/admin/user-controls/unsuspend/:userId",
    operationType: "unsuspend_user",
    actorId: adminId,
    actorRole: actor.actorRole,
    actorRoles: actor.actorRoles,
    targetType: "user",
    targetId: userId,
    resolutionSource: "route_param:user_id",
    reason,
    outcome: "completed",
    details: { verificationStatus: "pending" },
  });
  res.json({ success: true });
});

// Force verify
router.post("/verify/:userId", requireSuperAdmin, async (req, res) => {
  const userId = normalizeImmutableTargetId(req.params.userId);
  const actor = resolvePrivilegedActor((req as any).user);
  const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);
  const adminId = actor.actorId;

  if (!adminId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }
  if (!reason) {
    return res.status(400).json({ success: false, error: "reason is required (min 12 chars)" });
  }

  await storage.verifyUser(userId);
  await auditPrivilegedAction({
    action: "admin_user_verify",
    route: "/api/admin/user-controls/verify/:userId",
    operationType: "verify_user",
    actorId: adminId,
    actorRole: actor.actorRole,
    actorRoles: actor.actorRoles,
    targetType: "user",
    targetId: userId,
    resolutionSource: "route_param:user_id",
    reason,
    outcome: "completed",
    details: { verificationStatus: "approved", addressVerified: true },
  });
  res.json({ success: true });
});

// Revoke verify
router.post("/revoke-verify/:userId", requireSuperAdmin, async (req, res) => {
  const userId = normalizeImmutableTargetId(req.params.userId);
  const actor = resolvePrivilegedActor((req as any).user);
  const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);
  const adminId = actor.actorId;

  if (!adminId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }
  if (!reason) {
    return res.status(400).json({ success: false, error: "reason is required (min 12 chars)" });
  }

  await storage.revokeVerifyUser(userId);
  await auditPrivilegedAction({
    action: "admin_user_revoke_verify",
    route: "/api/admin/user-controls/revoke-verify/:userId",
    operationType: "revoke_user_verification",
    actorId: adminId,
    actorRole: actor.actorRole,
    actorRoles: actor.actorRoles,
    targetType: "user",
    targetId: userId,
    resolutionSource: "route_param:user_id",
    reason,
    outcome: "completed",
    details: { verificationStatus: "pending" },
  });
  res.json({ success: true });
});

// Change role
router.post("/role/:userId", requireSuperAdmin, async (req, res) => {
  const userId = normalizeImmutableTargetId(req.params.userId);
  const { newRole } = req.body;
  const actor = resolvePrivilegedActor((req as any).user);
  const reason = normalizePrivilegedReason((req.body ?? {}).reason, 12);
  const adminId = actor.actorId;

  if (!adminId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  if (!userId) {
    return res.status(400).json({ success: false, error: "userId is required" });
  }
  if (!reason) {
    return res.status(400).json({ success: false, error: "reason is required (min 12 chars)" });
  }
  if (typeof newRole !== "string" || !newRole.trim()) {
    return res.status(400).json({ success: false, error: "newRole is required" });
  }

  await storage.changeUserRole(userId, newRole);
  await auditPrivilegedAction({
    action: "admin_user_role_update",
    route: "/api/admin/user-controls/role/:userId",
    operationType: "change_user_role",
    actorId: adminId,
    actorRole: actor.actorRole,
    actorRoles: actor.actorRoles,
    targetType: "user",
    targetId: userId,
    resolutionSource: "route_param:user_id",
    reason,
    outcome: "completed",
    details: { newRole: String(newRole).trim() },
  });
  res.json({ success: true });
});

export default router;
