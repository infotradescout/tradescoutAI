import { Request, Response, NextFunction } from "express";
import { resolveRequestEffectiveUser } from "../utils/requestEffectiveUser";

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const identityContext = resolveRequestEffectiveUser(req);
  if (!identityContext.ok || identityContext.isImpersonating) {
    return res.status(403).json({
      error: "Super admin tools are unavailable while acting as another user.",
      code: "IMPERSONATION_PRIVILEGE_BOUNDARY",
    });
  }
  const user = (req as any).user;
  const rawRole = typeof user?.role === "string" ? user.role.trim().toLowerCase() : "";
  const normalizedRole = rawRole === "owner" || rawRole === "head_admin" ? "super_admin" : rawRole;
  if (user && (normalizedRole === "super_admin" || user.isSuperAdmin === true)) {
    return next();
  }
  return res.status(403).json({ error: "Super admin privileges required." });
}
