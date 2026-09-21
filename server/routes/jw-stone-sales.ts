import type { Express, Request, RequestHandler, Response } from "express";
import { z, ZodError } from "zod";
import { rateLimit } from "express-rate-limit";
import { isAuthenticated } from "../auth";
import { pool } from "../db";
import { requireJwStoneCartHoldWriteIntent } from "../utils/jwStoneCartHoldWriteIntent";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { JwStoneSales } from "../services/jwStoneSales";
import { renderJwStoneOrdersPage, jwStoneOrdersBrowserScript } from "../services/jwStoneOrdersPage";
import { JW_STONE_ORDERS_PATH, JW_STONE_ORDERS_PAGE, JwStoneSaleError } from "@shared/jwStoneCheckout";

export const JW_STONE_PAYMENT_WEBHOOK_PATH = JW_STONE_ORDERS_PATH + "/stripe/webhook";
const mounted = new WeakSet<Express>();
const actor = (req: Request) => String((req.user as { id?: string; claims?: { sub?: string } } | undefined)?.id || (req.user as { claims?: { sub?: string } } | undefined)?.claims?.sub || "").trim();
const id = (req: Request) => z.string().uuid().parse(req.params.requestId);
function privateResponse(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.vary("Cookie"); res.vary("Authorization");
}
function errorResponse(res: Response, error: unknown) {
  if (error instanceof JwStoneSaleError) return res.status(error.status).json({ code: error.code, message: error.message });
  if (error instanceof ZodError) return res.status(400).json({ code: "jw_order_input", message: "Check the order reference, amounts, expiration and confirmation fields." });
  return res.status(503).json({ code: "jw_order_unavailable", message: "The order service could not confirm this action. Refresh order/payment status before trying again. Your cart is unchanged." });
}
/** Optional dependencies support isolated acceptance. Production always uses canonical session/write guards. */
export function registerJwStoneSalesRoutes(app: Express, sales = new JwStoneSales(pool), authenticate: RequestHandler = isAuthenticated): void {
  if (mounted.has(app)) return;
  mounted.add(app);
  const mutationLimit: RequestHandler = process.env.NODE_ENV === "production" ? rateLimit({
    windowMs: 10 * 60_000, max: 30, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => "u:" + actor(req),
    store: createPostgresRateLimitStore({ pool, prefix: "jw_stone_sale_commands", cleanupIntervalMs: 600_000 }),
  }) : (_req, _res, next) => next();
  app.get(JW_STONE_ORDERS_PAGE, authenticate, (_req, res) => {
    privateResponse(res);
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    res.type("html").send(renderJwStoneOrdersPage());
  });
  app.get(JW_STONE_ORDERS_PATH + "/workspace.js", (_req, res) => {
    privateResponse(res); res.type("application/javascript").send(jwStoneOrdersBrowserScript);
  });
  app.get(JW_STONE_ORDERS_PATH, authenticate, async (req, res) => {
    privateResponse(res); try { res.json(await sales.list(actor(req))); } catch (error) { errorResponse(res, error); }
  });
  app.get(JW_STONE_ORDERS_PATH + "/:requestId", authenticate, async (req, res) => {
    privateResponse(res); try { res.json(await sales.read(id(req), actor(req))); } catch (error) { errorResponse(res, error); }
  });
  app.post(JW_STONE_ORDERS_PATH + "/:requestId/commands", authenticate, requireJwStoneCartHoldWriteIntent, mutationLimit, async (req, res) => {
    privateResponse(res); try { res.json(await sales.command(id(req), actor(req), req.body)); } catch (error) { errorResponse(res, error); }
  });
  app.post(JW_STONE_ORDERS_PATH + "/:requestId/reconcile", authenticate, requireJwStoneCartHoldWriteIntent, mutationLimit, async (req, res) => {
    privateResponse(res); try { z.object({}).strict().parse(req.body);const requestId=id(req);await sales.reconcile(requestId, actor(req));res.json(await sales.read(requestId, actor(req))); } catch (error) { errorResponse(res, error); }
  });
  app.post(JW_STONE_PAYMENT_WEBHOOK_PATH, async (req, res) => {
    privateResponse(res);
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.get("stripe-signature");
    if (!Buffer.isBuffer(raw) || !signature) { res.status(400).json({ message: "Signed original webhook bytes are required." });return; }
    let requestId: string | null;
    try { requestId = await sales.provider.webhookRequest(raw, signature); }
    catch { res.status(400).json({ message: "Webhook identity could not be verified." });return; }
    try { if(requestId) await sales.reconcile(z.string().uuid().parse(requestId), null);res.json({ received: true }); }
    catch { res.status(503).json({ message: "Payment reconciliation is incomplete; retry this event." }); }
  });
}
