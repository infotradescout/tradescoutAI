import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { isAuthenticated } from "../auth";
import { requireCriticalSchema } from "../schemaPreflight";
import {
  JwStoneEmployeeAccessError, jwStoneActorId,
  parseJwStoneEmployeeAccessChange, parseJwStoneEmployeeLookup,
} from "@shared/jwStoneEmployeeAccess";
import {
  listJwStoneEmployeeAccounts, findJwStoneEmployeeAccount, setJwStoneEmployeeAccess,
} from "../services/jwStoneEmployeeAccessService";

const BASE = "/api/u/jw-stone/receiving/staff";
export function isJwStoneStaffSameOrigin(req: Request): boolean {
  if (req.get("X-JW-Receiving") !== "1") return false;
  try {
    const origin = new URL(req.get("Origin") || "");
    return ["https:", "http:"].includes(origin.protocol) && origin.protocol === `${req.protocol}:` && !origin.username && !origin.password &&
      origin.origin === req.get("Origin") && origin.host.toLowerCase() === (req.get("Host") || "").toLowerCase();
  } catch { return false; }
}
function failure(res: Response, error: unknown) {
  if (error instanceof JwStoneEmployeeAccessError) {
    res.status(error.status).json({ message: error.message });
    return;
  }
  console.error("[jw-stone-employee-access] action failed", {
    message: error instanceof Error ? error.message : "Unknown employee access error",
  });
  res.status(503).json({ message: "Employee access could not be updated or loaded. Refresh the account before retrying." });
}
export function registerJwStoneEmployeeAccessRoutes(app: Express): void {
  app.use(BASE, (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.vary("Cookie"); res.vary("Authorization"); next();
  });
  const limit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false,
    keyGenerator: req => jwStoneActorId(req.user), message: { message: "Too many access requests. No additional access change was made." } });
  app.get(BASE, isAuthenticated, requireCriticalSchema("stone_inventory"), async (req: Request, res: Response) => {
    try { res.json(await listJwStoneEmployeeAccounts(req.user)); }
    catch (error) { failure(res, error); }
  });
  app.post(`${BASE}/lookup`, isAuthenticated, limit, requireCriticalSchema("stone_inventory"), async (req: Request, res: Response) => {
    if (!isJwStoneStaffSameOrigin(req)) { res.status(403).json({ message: "Manage employee access from the signed-in JW Stone website." }); return; }
    try { res.json(await findJwStoneEmployeeAccount(req.user, parseJwStoneEmployeeLookup(req.body))); }
    catch (error) { failure(res, error); }
  });
  app.put(BASE, isAuthenticated, limit, requireCriticalSchema("stone_inventory"), async (req: Request, res: Response) => {
    if (!isJwStoneStaffSameOrigin(req)) { res.status(403).json({ message: "Manage employee access from the signed-in JW Stone website." }); return; }
    try { res.json(await setJwStoneEmployeeAccess(req.user, parseJwStoneEmployeeAccessChange(req.body))); }
    catch (error) { failure(res, error); }
  });
}
