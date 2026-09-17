import express, { type Express, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { isAuthenticated, isSuperAdmin } from "../auth";
import { pool } from "../db";
import { BIDROCK_DEFAULT_PROFILE_SLUG } from "@shared/bidrock";
import {
  JW_STONE_FEATURE_KEY, JW_STONE_FEATURES_PATH, JW_STONE_FEATURE_ADMIN_PATH,
  JwStoneFeatureError, projectJwStoneFeatures,
} from "../../shared/jwStoneFeaturePolicy";
import { createJwStoneFeatureStore } from "../services/jwStoneFeatureStore";
import { decideJwStoneFeatureAccess } from "../services/jwStoneFeatureGateway";
import { renderJwStoneFeatureControl } from "../services/jwStoneFeatureControlPage";
const store = createJwStoneFeatureStore(pool);
const mounted = new WeakSet<Express>();
function noStore(res: Response) { res.setHeader("Cache-Control", "private, no-store"); res.vary("Cookie"); }
function errorResponse(res: Response, error: unknown) {
  const known = error instanceof JwStoneFeatureError;
  res.status(known ? error.status : 503).json({ code: known ? error.code : "FEATURE_CONTROL_UNAVAILABLE",
    message: known ? error.message : "JW Stone feature control is temporarily unavailable." });
}
function requireSameOrigin(req: Request) {
  const origin = req.get("Origin");
  if (!origin || origin !== `${req.protocol}://${req.get("host")}`) {
    throw new JwStoneFeatureError(403, "SAME_ORIGIN_REQUIRED", "Open feature control on this site's authenticated administration page.");
  }
}
/** Called after bindAuthenticatedRequestAuthority and before premium routes. */
export function registerJwStoneFeatureRoutes(app: Express): void {
  if (mounted.has(app)) return;
  mounted.add(app);
  app.get(JW_STONE_FEATURES_PATH, async (_req, res) => {
    noStore(res);
    try { const { audit: _privateAudit, ...state } = await store.read(); res.json(projectJwStoneFeatures(state)); }
    catch (error) { errorResponse(res, error); }
  });
  app.get(JW_STONE_FEATURE_ADMIN_PATH, isAuthenticated, isSuperAdmin, async (_req, res) => {
    noStore(res); try { res.json(await store.read()); } catch (error) { errorResponse(res, error); }
  });
  app.get("/admin/jw-stone-features", isAuthenticated, isSuperAdmin, async (_req, res) => {
    noStore(res);
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    try { res.type("html").send(renderJwStoneFeatureControl(await store.read(), randomUUID())); }
    catch (error) { errorResponse(res, error); }
  });
  app.put(JW_STONE_FEATURE_ADMIN_PATH, isAuthenticated, isSuperAdmin, async (req, res) => {
    noStore(res);
    try { requireSameOrigin(req); res.json(await store.change(String((req.user as { id?: string })?.id || ""), req.body)); }
    catch (error) { errorResponse(res, error); }
  });
  app.post(JW_STONE_FEATURE_ADMIN_PATH + "/form", isAuthenticated, isSuperAdmin,
    express.urlencoded({ extended: false, limit: "4kb" }), async (req, res) => {
      noStore(res);
      try {
        requireSameOrigin(req);
        if (!req.body || !["enabled", "base"].includes(req.body.mode)) throw new JwStoneFeatureError(400, "INVALID_FEATURE_MODE", "Choose the feature mode.");
        await store.change(String((req.user as { id?: string })?.id || ""), {
          enabled: req.body.mode === "enabled", expectedRevision: Number(req.body.expectedRevision),
          operationId: req.body.operationId, preserveBaseServices: req.body.preserveBaseServices === "true", note: req.body.note,
        });
        res.redirect(303, "/admin/jw-stone-features");
      } catch (error) { errorResponse(res, error); }
    });
  app.use(async (req: Request, res: Response, next) => {
    // The generic flag editor (including bulk toggles) must not mutate/delete this record.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && /^\/api\/admin\/feature-flags(?:\/|$)/i.test(req.path)) {
      try {
        const rawId = req.path.split("/")[4];
        const id = rawId ? decodeURIComponent(rawId) : undefined;
        const reserved = req.body?.key === JW_STONE_FEATURE_KEY || (id && (await pool.query(
          "SELECT key FROM feature_flags WHERE id = $1 AND key = $2", [id, JW_STONE_FEATURE_KEY])).rows.length > 0);
        if (reserved) { noStore(res); res.status(409).json({ message: "Use the dedicated JW Stone feature control to change this protected setting." }); return; }
      } catch (error) { errorResponse(res, error); return; }
    }
    const decision = await decideJwStoneFeatureAccess({ path: req.path, method: req.method,
      body: req.body, bidRockProfileSlug: BIDROCK_DEFAULT_PROFILE_SLUG }, () => store.read());
    if (decision.allowed) { next(); return; }
    noStore(res); res.status(decision.status).json({ code: decision.code, message: decision.message });
  });
}
