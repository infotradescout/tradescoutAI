import { Router, type RequestHandler, type Response } from "express";
import { isAuthenticated } from "../auth";
import { HomeIdentityError, loadHomeIdentity, saveHomeIdentity } from "../services/homeIdentityService";

const userId = (req: any) => String(req.user?.claims?.sub || req.user?.id || "").trim();
function failure(res: Response, error: unknown) {
  if (error instanceof HomeIdentityError) {
    return res.status(error.status).json({ message: error.message, code: error.code, fieldErrors: error.fieldErrors });
  }
  return res.status(500).json({ message: "Property details could not be saved or loaded. Please retry.", code: "PROPERTY_UNAVAILABLE" });
}

/** Dependencies are injectable for isolated tests; production always uses the existing auth middleware. */
export function createHomeIdentityRouter(dependencies: {
  authenticate?: RequestHandler;
  load?: typeof loadHomeIdentity;
  save?: typeof saveHomeIdentity;
} = {}) {
  const router = Router();
  const authenticate = dependencies.authenticate || isAuthenticated;
  const load = dependencies.load || loadHomeIdentity;
  const save = dependencies.save || saveHomeIdentity;
  router.get("/api/homes/:homeId/identity", authenticate, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try { return res.json(await load(userId(req), String(req.params.homeId || "").trim())); }
    catch (error) { return failure(res, error); }
  });
  router.patch("/api/homes/:homeId/identity", authenticate, async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try { return res.json(await save(userId(req), String(req.params.homeId || "").trim(), req.body)); }
    catch (error) { return failure(res, error); }
  });
  return router;
}
export const homeIdentityRouter = createHomeIdentityRouter();
