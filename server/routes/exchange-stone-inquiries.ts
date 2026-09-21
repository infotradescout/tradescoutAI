import type { Express } from "express";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { notifications } from "@shared/schema";
import { sanitizePublicListingText } from "@shared/publicListingSafety";
import { pool } from "../db";
import { isAuthenticated } from "../auth";
import { exposureAuthoritySqlPredicate } from "../services/exposureAuthority";
import { captureAcquisition } from "../services/exchangeStoneFunnel";
import { saveStoneInquiry, StoneInquiryError, type StoneInquiryCommand, type StoneQueryClient } from "../services/exchangeStoneInquiryTransaction";
import { CANONICAL_WEB_HOST, resolveMappedProfileShareSlug } from "../utils/publicOrigin";

const stateNames = new Map("Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming".split("|").map((name, index) => [name.toUpperCase(), "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ")[index]]));
const states = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));
const canonical = (req: any) => !resolveMappedProfileShareSlug(req) &&
  [CANONICAL_WEB_HOST, "thetradescout.com", "tradescoutai.onrender.com", "localhost", "127.0.0.1"].includes(
    String(req.headers.host || "").toLowerCase().split(":")[0]
  );

// Location is server-held account context. Never substitute Escambia County or a radius.
// This contact adapter does not implement the pending geographic discovery-feed integration.
export function stoneInquiryMarket(user: Record<string, unknown>): string {
  let state = String(user.state_code || user.state || "").trim().toUpperCase();
  state = stateNames.get(state) || state;
  const country = String(user.country_code || user.country || "").trim().toUpperCase();
  const city = String(user.city || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if ((country && !["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(country)) || !states.has(state))
    throw new StoneInquiryError("MARKET_REQUIRED", 409, "Confirm your US city and state before sending this stone inquiry.");
  if (state === "FL" && !city)
    throw new StoneInquiryError("MARKET_REQUIRED", 409, "Confirm your city before sending this stone inquiry.");
  if (state === "FL" && city.toLowerCase() === "pensacola")
    throw new StoneInquiryError("LISTING_UNAVAILABLE", 404, "Listing not available in the selected market.");
  const cityKey = city.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `US.${state}.${cityKey || "unspecified-city"}`;
}

async function authorizeOffer(tx: StoneQueryClient, command: StoneInquiryCommand) {
  // Explicit server configuration is populated with the verified TradeScout seller during import.
  // Neither a client-supplied seller nor the supplier's account is accepted as a fallback.
  const settings = await tx.query(
    `SELECT value FROM site_settings WHERE category = 'general'
     AND key = 'exchange_stone_retail_seller_user_id' AND is_active = true ORDER BY id LIMIT 2`
  );
  const configured = settings.rows.length === 1 ? settings.rows[0].value : null;
  if (typeof configured !== "string" || !configured.trim())
    throw new StoneInquiryError("SELLER_UNCONFIGURED", 503, "Stone sales are not available yet. Your message is still here.");
  const query = new PgDialect().sqlToQuery(sql`
    SELECT l.* FROM marketplace_listings l
    WHERE l.id = ${command.listingId} AND l.seller_id = ${configured}
      AND l.status = 'active' AND (l.expires_at IS NULL OR l.expires_at > now())
      AND ${exposureAuthoritySqlPredicate(sql`l.seller_id`)}
    FOR SHARE OF l
  `);
  const result = await tx.query(query.sql, query.params);
  const row = result.rows[0];
  if (!row || row.specifications?.commerceChannel !== "tradescout_stone_retail" ||
      row.specifications?.sellerBrand !== "TradeScout" || !["sqft", "slab"].includes(row.specifications?.priceUnit))
    throw new StoneInquiryError("LISTING_UNAVAILABLE", 404, "Listing not found.");
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(row.price)) || Number(row.price) <= 0)
    throw new StoneInquiryError("PRICE_UNAVAILABLE", 409, "This stone does not have an approved selling price.");
  const [whole, fraction = ""] = String(row.price).split(".");
  const priceCents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(priceCents) || priceCents > 9999999999)
    throw new StoneInquiryError("PRICE_UNAVAILABLE", 409, "This stone does not have a valid selling price.");
  const buyer = await tx.query("SELECT to_jsonb(u) AS account FROM users u WHERE id = $1 FOR SHARE", [command.buyerId]);
  if (!buyer.rows[0]?.account) throw new StoneInquiryError("AUTH_REQUIRED", 401, "Sign in before sending an inquiry.");
  const marketKey = stoneInquiryMarket(buyer.rows[0].account);
  const terms = createHash("sha256").update(JSON.stringify([
    row.specifications?.shippingPolicy || null, row.specifications?.exactSlab || null,
    row.specifications?.referenceSizesInches || null, row.specifications?.material || null,
  ])).digest("hex");
  return { sellerId: String(row.seller_id), title: sanitizePublicListingText(row.title, 200),
    priceCents, unit: row.specifications.priceUnit, fulfillmentTermsKey: terms, marketKey };
}

/** Mounted once, after authentication/effective-account binding, before the legacy handler. */
export function registerExchangeStoneInquiryRoutes(app: Express): void {
  app.use((req: any, _res, next) => {
    if (req.method === "GET" && canonical(req) && req.session && !req.session.exchangeStoneJourney &&
        /^\/(?:exchange(?:\/|$)|api\/exchange(?:\/|$)|api\/marketplace\/listings(?:\/|$))/.test(req.path)) {
      req.session.exchangeStoneJourney = { id: randomUUID(),
        acquisition: captureAcquisition(req.originalUrl || req.url, req.get("referer")) };
    }
    next();
  });

  app.post("/api/marketplace/inquiries", (req: any, res, next) => {
    if (typeof req.body?.listingId !== "string" || !req.body.listingId.startsWith("tradescout-stone-")) return next("route");
    return isAuthenticated(req, res, next);
  }, async (req: any, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      if (!canonical(req)) return res.status(404).json({ message: "Listing not found." });
      const buyerId = String(req.user?.id || req.user?.claims?.sub || "").trim();
      if (!req.isAuthenticated?.() || !buyerId) return res.status(401).json({ message: "Sign in before sending an inquiry." });
      if (req.body.authorityGate !== "decision_card" ||
          req.body.decisionScope !== `marketplace_listing:${req.body.listingId}`)
        return res.status(400).json({ message: "A matching Decision Card is required.", reasonCode: "DECISION_CARD_REQUIRED" });
      if (req.body.offerAmount !== undefined && req.body.offerAmount !== null)
        return res.status(400).json({ message: "This TradeScout stone has a fixed listed price." });
      if (typeof req.body.message !== "string" || req.body.message.length > 4000)
        return res.status(400).json({ message: "Provide a message of up to 4000 characters." });
      const message = sanitizePublicListingText(req.body.message, 4000);
      const journey = req.session?.exchangeStoneJourney;
      const result = await saveStoneInquiry({ buyerId, listingId: req.body.listingId,
        decisionId: req.body.sourceDecisionCardId, requestKey: req.body.requestKey,
        message, inquiryIntent: req.body.inquiryIntent ?? "availability" }, {
        pool, metricsSecret: process.env.STONE_METRICS_SECRET || "",
        environment: process.env.NODE_ENV === "production" ? "production" : "test",
        journeyKey: journey?.id || `unknown:${randomUUID()}`,
        // Missing first-touch evidence stays unattributed; a POST's internal referrer cannot overwrite it.
        acquisition: journey?.acquisition || captureAcquisition("/"),
        authorizeOffer,
        insertNotification: async (tx, input) => {
          const database = drizzle({ client: tx as any });
          await database.insert(notifications).values({
            id: input.id, userId: input.sellerId, type: "new_message", priority: "high",
            title: input.inquiryIntent === "callback" ? "Stone callback requested" : "New stone inquiry",
            message: `A buyer asked about ${input.title}.`,
            actionUrl: `/messages?thread=${input.conversationId}&type=marketplace`,
            actionText: "View message", iconName: "MessageCircle", iconColor: "orange",
            deliveryMethods: ["in_app", "push"], metadata: { inquiryId: input.inquiryId,
              conversationId: input.conversationId, listingId: input.listingId },
          } as any);
        },
      });
      // The in-app notification and seller inbox message are already committed.
      // Push is supplementary, never evidence of a connected call or a reason to resend.
      if (!result.replayed) {
        void import("../notification-service")
          .then(({ notificationService }) => notificationService.sendNotification(result.receipt.notificationId))
          .catch(() => console.warn("[stone-inquiry] push delivery unavailable; durable seller inbox retained"));
        // Preserve the existing marketplace email notice as a separate best-effort delivery.
        // Neither email nor push failure changes the committed inquiry or buyer count.
        void import("../services/emailService").then(async ({ emailService }) => {
          if (!emailService.isConfigured()) return;
          const owner = await pool.query(
            `SELECT u.email FROM marketplace_inquiries i JOIN users u ON u.id = i.seller_id
             WHERE i.id = $1 AND i.buyer_id = $2`, [result.receipt.id, buyerId]
          );
          if (!owner.rows[0]?.email) return;
          const replyPath = `/messages?thread=${encodeURIComponent(result.receipt.conversationId)}&type=marketplace`;
          const replyUrl = `https://www.thetradescout.com${replyPath}`;
          await emailService.sendEmail({ to: owner.rows[0].email, subject: "New TradeScout stone inquiry",
            text: `A buyer sent a stone inquiry. Reply in TradeScout: ${replyUrl}`,
            html: `<p>A buyer sent a stone inquiry.</p><p><a href="${replyUrl.replace(/&/g, "&amp;")}">Reply in TradeScout</a></p>`,
            purpose: "marketplace_inquiry" });
        }).catch(() => console.warn("[stone-inquiry] email delivery unavailable; durable seller inbox retained"));
      }
      return res.status(result.replayed ? 200 : 201).json({ ...result.receipt, replayed: result.replayed });
    } catch (error) {
      if (error instanceof StoneInquiryError) return res.status(error.status).json({ message: error.message, reasonCode: error.code });
      console.error("[stone-inquiry] save failed", { code: (error as any)?.code || "unknown" });
      return res.status(503).json({ message: "Could not confirm delivery. Keep your message and retry this request.", reasonCode: "INQUIRY_SAVE_UNCONFIRMED" });
    }
  });
}
