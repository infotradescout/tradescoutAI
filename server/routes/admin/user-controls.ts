import { Router } from 'express';
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin';
import { logAdminAction } from '../../services/adminAuditLogService';
import { storage } from '../../storage';

const router = Router();

// Suspend user
router.post('/suspend/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  await storage.suspendUser(userId);
  await logAdminAction({ type: 'suspend', userId, adminId: req.user.id });
  res.json({ success: true });
});

// Unsuspend user
router.post('/unsuspend/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  await storage.unsuspendUser(userId);
  await logAdminAction({ type: 'unsuspend', userId, adminId: req.user.id });
  res.json({ success: true });
});

// Force verify
router.post('/verify/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  await storage.verifyUser(userId);
  await logAdminAction({ type: 'verify', userId, adminId: req.user.id });
  res.json({ success: true });
});

// Revoke verify
router.post('/revoke-verify/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  await storage.revokeVerifyUser(userId);
  await logAdminAction({ type: 'revoke_verify', userId, adminId: req.user.id });
  res.json({ success: true });
});

// Change role
router.post('/role/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  const { newRole } = req.body;
  await storage.changeUserRole(userId, newRole);
  await logAdminAction({ type: 'role_change', userId, newRole, adminId: req.user.id });
  res.json({ success: true });
});

export default router;
