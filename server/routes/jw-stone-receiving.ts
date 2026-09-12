import { streamPublicObject } from "../publicMediaStorage";
import { listPublicStoneNewArrivals } from "../services/stoneNewArrivalsService";
import { STONE_CURRENT_INVENTORY_FRESHNESS_DAYS } from "@shared/stoneInventory";
import type { Express, Request, Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { isAuthenticated } from "../auth";
import { pool } from "../db";
import { requireCriticalSchema } from "../schemaPreflight";
import { getPublicProfileTrustContext } from "./profiles";
import { getStoneInventoryProfileTarget, listPublicCurrentStoneInventory } from "../services/stoneInventoryService";
import { resolveJwStonePricingAccess } from "../services/jwStonePricingAccess";
import { receivingConfigured } from "../services/jwStoneReceivingMedia";
import { jwStoneEmployeeTarget, receivingUserId, receiveJwStoneArrival, JwStoneReceivingConflict } from "../services/jwStoneReceivingService";
import { JW_STONE_RECEIVING_MAX_PHOTOS, JW_STONE_RECEIVING_MAX_PHOTO_BYTES, JwStoneReceivingInputError, parseJwStoneReceipt, jwStoneReceiptMemberPrice, jwStoneReceivingPhotoKey } from "@shared/jwStoneReceiving";

const BASE = "/api/u/jw-stone/receiving";
function privateResponse(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.vary("Cookie"); res.vary("Authorization");
}
export function registerJwStoneReceivingRoutes(app: Express): void {
  const upload = multer({ storage: multer.memoryStorage(), limits: { files: JW_STONE_RECEIVING_MAX_PHOTOS, fileSize: JW_STONE_RECEIVING_MAX_PHOTO_BYTES, fields: 1, fieldSize: 16384, parts: JW_STONE_RECEIVING_MAX_PHOTOS + 1 } }).array("photos", JW_STONE_RECEIVING_MAX_PHOTOS);
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: "draft-7", legacyHeaders: false, keyGenerator: req => receivingUserId(req.user), message: { message: "Too many receiving attempts. Your entries are still on this screen." } });
  const photoRoute = "/images/businesses/jw-stone/receiving/:receiptId/:fileName";
  const photo = async (req: Request, res: Response) => {
    const key = jwStoneReceivingPhotoKey(String(req.params.receiptId), String(req.params.fileName));
    if (!key) { res.status(404).end(); return; }
    try {
      const result = await streamPublicObject({ req, res, key });
      if (result !== "served" && !res.headersSent) { res.setHeader("Cache-Control", "no-store"); res.status(result === "not_found" ? 404 : 503).end(); }
    } catch { if (!res.headersSent) { res.setHeader("Cache-Control", "no-store"); res.status(503).end(); } }
  };
  app.head(photoRoute, photo); app.get(photoRoute, photo);
  // Fresh reads after receiving; public projection contains no prices, notes, rack or costs.
  app.get(`${BASE}/arrivals`, requireCriticalSchema("stone_inventory"), async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    try {
      const context = await getPublicProfileTrustContext("jw-stone");
      const target = await getStoneInventoryProfileTarget("jw-stone");
      if (!context?.businessId || !target || context.businessId !== target.businessId) { res.status(404).json({ message: "JW Stone inventory is unavailable." }); return; }
      res.json({ profileSlug: "jw-stone", freshnessDays: STONE_CURRENT_INVENTORY_FRESHNESS_DAYS, generatedAt: new Date().toISOString(), items: await listPublicStoneNewArrivals(target) });
    } catch { res.status(503).json({ message: "New arrivals are temporarily unavailable." }); }
  });
  app.get(`${BASE}/access`, isAuthenticated, async (req: Request, res: Response) => {
    privateResponse(res);
    try { res.json({ viewerId: receivingUserId(req.user), allowed: Boolean(await jwStoneEmployeeTarget(req.user)), enabled: receivingConfigured() }); }
    catch { res.status(503).json({ message: "Employee inventory access is temporarily unavailable." }); }
  });
  app.get(`${BASE}/receipts`, isAuthenticated, requireCriticalSchema("stone_inventory"), async (req: Request, res: Response) => {
    privateResponse(res);
    try {
      const target = await jwStoneEmployeeTarget(req.user);
      if (!target) { res.status(403).json({ message: "Assigned JW Stone employee access is required." }); return; }
      const result = await pool.query(`SELECT ap.public_id AS "publicId", ap.condition_json->'jwReceiving'->'receipt' AS receipt,
        ap.condition_json->'jwReceiving'->>'state' AS state, ip.public_availability_status AS "publicationStatus", ip.received_at AS "receivedAt"
        FROM stone_asset_passports ap JOIN stone_inventory_positions ip ON ip.asset_passport_id = ap.id
        WHERE ip.holder_business_id = $1 AND ap.condition_json ? 'jwReceiving'
        ORDER BY ip.received_at DESC LIMIT 50`, [target.businessId]);
      res.json({ viewerId: receivingUserId(req.user), items: result.rows });
    } catch { res.status(503).json({ message: "Recent arrivals are temporarily unavailable." }); }
  });
  app.get(`${BASE}/prices`, isAuthenticated, requireCriticalSchema("stone_inventory"), async (req: Request, res: Response) => {
    privateResponse(res);
    try {
      const viewerId = receivingUserId(req.user);
      const employee = await jwStoneEmployeeTarget(req.user);
      const access = employee ? "internal" : await resolveJwStonePricingAccess({ userId: viewerId, user: req.user });
      if (access === "none") { res.status(403).json({ message: "An active JW Stone business membership is required to view pricing." }); return; }
      const context = await getPublicProfileTrustContext("jw-stone");
      const target = await getStoneInventoryProfileTarget("jw-stone");
      if (!context?.businessId || !target || context.businessId !== target.businessId) { res.status(404).json({ message: "JW Stone inventory is unavailable." }); return; }
      const visible = new Set((await listPublicCurrentStoneInventory(target)).map(item => item.id));
      const result = await pool.query(`SELECT ap.public_id, ap.condition_json->'jwReceiving'->'receipt' AS receipt
        FROM stone_asset_passports ap JOIN stone_inventory_positions ip ON ip.asset_passport_id = ap.id
        WHERE ip.holder_business_id = $1 AND ap.condition_json->'jwReceiving'->>'state' = 'published'`, [target.businessId]);
      const prices = result.rows.filter(row => visible.has(row.public_id)).map(row => jwStoneReceiptMemberPrice(parseJwStoneReceipt(row.receipt)));
      res.json({ viewerId, prices }); // Explicit projection: never return the receipt or landed cost.
    } catch { res.status(503).json({ message: "Arrival pricing is temporarily unavailable." }); }
  });
  app.post(`${BASE}/receipts`, isAuthenticated, limiter, requireCriticalSchema("stone_inventory"), async (req: Request, res: Response) => {
    privateResponse(res);
    // A custom header makes this a non-simple CORS request. Do not broaden CORS for receiving.
    if (req.get("X-JW-Receiving") !== "1") { res.status(403).json({ message: "Use the JW Stone receiving screen." }); return; }
    let target;
    try { target = await jwStoneEmployeeTarget(req.user); }
    catch { res.status(503).json({ message: "Employee inventory access is temporarily unavailable." }); return; }
    if (!target) { res.status(403).json({ message: "Assigned JW Stone employee access is required." }); return; }
    if (!receivingConfigured()) { res.status(503).json({ message: "Employee receiving has not been enabled by your manager." }); return; }
    const employeeTarget = target;
    // Authorization happens BEFORE any photo buffers are allocated.
    upload(req, res, async (uploadError: unknown) => {
      if (uploadError) { res.status(400).json({ message: "Use one to eight photos, each no larger than 10 MB." }); return; }
      try {
        let value: unknown;
        try { value = JSON.parse(String(req.body?.receipt || "")); }
        catch { throw new JwStoneReceivingInputError("Enter the arrival details."); }
        const receipt = parseJwStoneReceipt(value);
        const files = Array.isArray(req.files) ? req.files : [];
        const result = await receiveJwStoneArrival(employeeTarget, receivingUserId(req.user), receipt, files.map(file => file.buffer));
        res.status(result.alreadySaved ? 200 : 201).json(result);
      } catch (error) {
        if (error instanceof JwStoneReceivingInputError) { res.status(400).json({ message: error.message }); return; }
        if (error instanceof JwStoneReceivingConflict) { res.status(409).json({ message: error.message }); return; }
        console.error("[jw-stone-receiving] save incomplete", { message: error instanceof Error ? error.message : "Unknown receiving error" });
        res.status(503).json({ message: "The arrival could not finish saving. Keep this screen open and retry the same submission. Nothing is listed until the photos and details are saved." });
      }
    });
  });
}
