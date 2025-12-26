import { Router } from 'express';
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin';
import { createImpersonationToken, endImpersonation, logImpersonationEvent } from '../../services/adminImpersonationService';

const router = Router();

// Start impersonation
router.post('/start/:userId', requireSuperAdmin, async (req, res) => {
  const adminId = req.user.id;
  const targetUserId = req.params.userId;
  const ip = req.ip;
  try {
    const token = await createImpersonationToken(adminId, targetUserId);
    await logImpersonationEvent({ adminId, targetUserId, startedAt: new Date(), ip, action: 'start' });
    res.json({ success: true, token, impersonating: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Exit impersonation
router.post('/exit', requireSuperAdmin, async (req, res) => {
  const adminId = req.user.id;
  try {
    await endImpersonation(adminId);
    await logImpersonationEvent({ adminId, endedAt: new Date(), action: 'exit' });
    res.json({ success: true, impersonating: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
