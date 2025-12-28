import { Router } from 'express';
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin';
import { logAdminAction } from '../../services/adminAuditLogService';
import { storage } from '../../storage';

const router = Router();

// Suspend user
router.post('/suspend/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  const admin = (req as any).user;
  const adminId = admin?.id;

  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  await storage.suspendUser(userId);
  await logAdminAction({ type: 'suspend', userId, adminId });
  res.json({ success: true });
});

// Unsuspend user
router.post('/unsuspend/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  const admin = (req as any).user;
  const adminId = admin?.id;

  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  await storage.unsuspendUser(userId);
  await logAdminAction({ type: 'unsuspend', userId, adminId });
  res.json({ success: true });
});

// Force verify
router.post('/verify/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  const admin = (req as any).user;
  const adminId = admin?.id;

  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  await storage.verifyUser(userId);
  await logAdminAction({ type: 'verify', userId, adminId });
  res.json({ success: true });
});

// Revoke verify
router.post('/revoke-verify/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  const admin = (req as any).user;
  const adminId = admin?.id;

  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  await storage.revokeVerifyUser(userId);
  await logAdminAction({ type: 'revoke_verify', userId, adminId });
  res.json({ success: true });
});

// Change role
router.post('/role/:userId', requireSuperAdmin, async (req, res) => {
  const { userId } = req.params;
  const { newRole } = req.body;
  const admin = (req as any).user;
  const adminId = admin?.id;

  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  await storage.changeUserRole(userId, newRole);
  await logAdminAction({ type: 'role_change', userId, newRole, adminId });
  res.json({ success: true });
});

export default router;
