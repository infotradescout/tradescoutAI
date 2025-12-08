
import { Router } from 'express';

const router = Router();

// Transactions are handled via marketplace and contractor payment flows elsewhere.
router.post('/create', (_req, res) => {
  res.status(501).json({ message: 'Transactions API is not implemented in this deployment' });
});

export default router;
