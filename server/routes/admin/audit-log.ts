import { Router } from 'express';
import { requireSuperAdmin } from '../../middleware/requireSuperAdmin';
import { getAdminAuditLog } from '../../services/adminAuditLogService';

const router = Router();

router.get('/', requireSuperAdmin, async (req, res) => {
  const log = await getAdminAuditLog(200);
  res.json({ log });
});

export default router;
