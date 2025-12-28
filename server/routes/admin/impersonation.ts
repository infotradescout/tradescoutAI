import { Router } from 'express';
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin';
import { createImpersonationToken, endImpersonation, logImpersonationEvent } from '../../services/adminImpersonationService';

const router = Router();

// Start impersonation
router.post('/start/:userId', requireSuperAdmin, async (req, res) => {
  const admin = (req as any).user;
  const adminId = admin?.id;
  const targetUserId = req.params.userId;
  const ip = req.ip;
  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const token = await createImpersonationToken(adminId, targetUserId);
    await logImpersonationEvent({ adminId, targetUserId, startedAt: new Date(), ip, action: 'start' });
    res.json({ success: true, token, impersonating: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to start impersonation' });
  }
});

// Exit impersonation
router.post('/exit', requireSuperAdmin, async (req, res) => {
  const admin = (req as any).user;
  const adminId = admin?.id;
  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    await endImpersonation(adminId);
    await logImpersonationEvent({ adminId, endedAt: new Date(), action: 'exit' });
    res.json({ success: true, impersonating: false });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to end impersonation' });
  }
});

export default router;
