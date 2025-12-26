import { Request, Response, NextFunction } from 'express';

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user && req.user.role === 'head_admin') {
    return next();
  }
  return res.status(403).json({ error: 'Super admin privileges required.' });
}
