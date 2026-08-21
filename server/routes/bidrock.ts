import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  BIDROCK_DEFAULT_PROFILE_SLUG,
  BIDROCK_PUBLIC_ROUTE,
  BIDROCK_PRICE_UNITS,
  BIDROCK_HANDOFF_TYPES,
  buildBidRockSourceProfileAccountPath,
  normalizeBidRockAmountToCents,
} from "@shared/bidrock";
import { isAuthenticated } from "../auth";
import { requireCriticalSchema } from "../schemaPreflight";
import {
  acceptBidRockOffer,
  cancelBidRockOrder,
  clearBidRockListingPrice,
  closeExpiredBidRockAuctions,
  completeBidRockOrder,
  configureBidRockAuction,
  createBidRockOffer,
  getBidRockAuction,
  getBidRockViewerContext,
  getBidRockOrderWorkspace,
  linkBidRockOrderSystems,
  listBidRockCatalog,
  listBidRockOffers,
  listBidRockOrders,
  listBidRockProviderAssignments,
  listBidRockSellerInventory,
  markBidRockOrderPaymentReady,
  placeBidRockMaximumBid,
  recordBidRockHandoff,
  recordBidRockPaymentSettlement,
  releaseExpiredBidRockReservations,
  respondToBidRockOffer,
  setBidRockListingPrice,
  setBidRockListingSaleReady,
  setBidRockOrderDelegation,
  setBidRockSavedListing,
  syncBidRockStoneInventory,
} from "../services/bidrockService";

const uuidSchema = z.string().uuid();
const publicListingIdSchema = z.string().regex(/^brl_[a-z0-9]{20,80}$/);
const publicAuctionIdSchema = z.string().regex(/^bra_[a-z0-9]{20,80}$/);
const publicOrderIdSchema = z.string().regex(/^bro_[a-z0-9]{20,80}$/);
const priceSchema = z
  .object({
    amount: z.union([z.number(), z.string().trim().min(1)]),
    unit: z.enum(BIDROCK_PRICE_UNITS),
  })
  .strict();
const offerSchema = z
  .object({
    quantity: z.number().int().positive().max(100_000),
    totalAmount: z.union([z.number(), z.string().trim().min(1)]),
    message: z.string().trim().max(1_000).nullable().optional(),
    idempotencyKey: z.string().trim().min(8).max(160).optional(),
  })
  .strict();
const auctionConfigurationSchema = z
  .object({
    openingBid: z.union([z.number(), z.string().trim().min(1)]),
    reserveBid: z
      .union([z.number(), z.string().trim().min(1)])
      .nullable()
      .optional(),
    minimumIncrement: z.union([z.number(), z.string().trim().min(1)]),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    pickupTerms: z.string().trim().min(1).max(2_000),
    freightTerms: z.string().trim().min(1).max(2_000),
  })
  .strict();
const bidSchema = z
  .object({
    maximumBid: z.union([z.number(), z.string().trim().min(1)]),
    idempotencyKey: z.string().trim().min(8).max(160).optional(),
  })
  .strict();

function getUserId(req: Request): string | null {
  const user = req.user as any;
  const value = String(user?.id || user?.claims?.sub || "").trim();
  return value || null;
}

function idempotencyKey(req: Request, bodyValue?: string): string {
  return String(req.get("Idempotency-Key") || bodyValue || "")
    .trim()
    .slice(0, 160);
}

function respondError(res: Response, error: unknown, fallback: string): void {
  const message = error instanceof Error ? error.message : fallback;
  const status = /authentication|buyer access/i.test(message)
    ? 401
    : /verified business|seller access|publication access|auction configuration access|handoff provider access|order access|offer .* access|admin access|administrative accounts|cannot bid|own inventory|owned by their business/i.test(
          message
        )
      ? 403
      : /not found/i.test(message)
        ? 404
        : /cannot|can no longer|not sale-ready|requires|required|must be at least|has not started|has ended|does not match|not ready|not settled|in progress|refused|expired|changed|allocated|collision|immutable|duplicated|move backward/i.test(
              message
            )
          ? 409
          : 500;
  if (status === 500) console.error("[bidrock] request failed", error);
  res.status(status).json({ message: status === 500 ? fallback : message });
}

function requireUser(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) res.status(401).json({ message: "Authentication required" });
  return userId;
}

export function registerBidRockRoutes(app: Express): void {
  app.use(["/api/bidrock", "/api/admin/bidrock"], requireCriticalSchema("bidrock"));
  app.get("/api/bidrock/catalog", async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", getUserId(req) ? "private, no-store" : "public, max-age=30");
      res.json(await listBidRockCatalog(getUserId(req)));
    } catch (error) {
      console.error("[bidrock] catalog failed", error);
      res.status(500).json({ message: "BidRock is temporarily unavailable" });
    }
  });

  app.get("/api/bidrock/auctions/:id", async (req: Request, res: Response) => {
    const auctionId = publicAuctionIdSchema.safeParse(req.params.id);
    if (!auctionId.success) {
      res.status(400).json({ message: "A valid auction is required" });
      return;
    }
    try {
      res.setHeader("Cache-Control", getUserId(req) ? "private, no-store" : "public, max-age=5");
      res.json(await getBidRockAuction(auctionId.data, getUserId(req)));
    } catch (error) {
      respondError(res, error, "Auction is temporarily unavailable");
    }
  });

  app.post(
    "/api/bidrock/listings/:id/auction",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const listingId = publicListingIdSchema.safeParse(req.params.id);
      const body = auctionConfigurationSchema.safeParse(req.body);
      if (!userId) return;
      if (!listingId.success || !body.success) {
        res.status(400).json({
          message: body.success
            ? "A valid listing is required"
            : body.error.issues[0]?.message || "Valid auction details are required",
        });
        return;
      }
      const openingBidCents = normalizeBidRockAmountToCents(body.data.openingBid);
      const minimumIncrementCents = normalizeBidRockAmountToCents(body.data.minimumIncrement);
      const reserveBidCents =
        body.data.reserveBid === null || body.data.reserveBid === undefined
          ? null
          : normalizeBidRockAmountToCents(body.data.reserveBid);
      if (
        !openingBidCents ||
        !minimumIncrementCents ||
        (body.data.reserveBid != null && !reserveBidCents)
      ) {
        res.status(400).json({ message: "Auction dollar values must be positive" });
        return;
      }
      try {
        res.status(201).json(
          await configureBidRockAuction({
            userId,
            listingId: listingId.data,
            openingBidCents,
            reserveBidCents,
            minimumIncrementCents,
            startsAt: body.data.startsAt,
            endsAt: body.data.endsAt,
            pickupTerms: body.data.pickupTerms,
            freightTerms: body.data.freightTerms,
          })
        );
      } catch (error) {
        respondError(res, error, "Auction could not be scheduled");
      }
    }
  );

  app.post(
    "/api/bidrock/auctions/:id/bids",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const auctionId = publicAuctionIdSchema.safeParse(req.params.id);
      const body = bidSchema.safeParse(req.body);
      if (!userId) return;
      if (!auctionId.success || !body.success) {
        res.status(400).json({ message: "A valid auction and maximum bid are required" });
        return;
      }
      const maxAmountCents = normalizeBidRockAmountToCents(body.data.maximumBid);
      const key = idempotencyKey(req, body.data.idempotencyKey);
      if (!maxAmountCents || !key) {
        res.status(400).json({ message: "Maximum bid and idempotency key are required" });
        return;
      }
      try {
        res.status(201).json(
          await placeBidRockMaximumBid({
            userId,
            auctionId: auctionId.data,
            maxAmountCents,
            idempotencyKey: key,
          })
        );
      } catch (error) {
        respondError(res, error, "Maximum bid could not be placed");
      }
    }
  );

  app.post(
    "/api/admin/bidrock/maintenance/project-inventory",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      if (!userId) return;
      try {
        const viewer = await getBidRockViewerContext(userId);
        if (!viewer.admin) {
          res.status(403).json({ message: "BidRock admin access required" });
          return;
        }
        res.json({ projectedListings: await syncBidRockStoneInventory() });
      } catch (error) {
        respondError(res, error, "BidRock inventory projection failed");
      }
    }
  );

  app.post(
    "/api/admin/bidrock/maintenance/expire-holds",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      if (!userId) return;
      try {
        const viewer = await getBidRockViewerContext(userId);
        if (!viewer.admin) {
          res.status(403).json({ message: "BidRock admin access required" });
          return;
        }
        res.json({ expiredReservations: await releaseExpiredBidRockReservations() });
      } catch (error) {
        respondError(res, error, "BidRock hold expiry failed");
      }
    }
  );

  app.post(
    "/api/admin/bidrock/maintenance/close-auctions",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      if (!userId) return;
      try {
        const outcomes = await closeExpiredBidRockAuctions(userId);
        res.json({ closedAuctions: outcomes.length, outcomes });
      } catch (error) {
        respondError(res, error, "Auction closure maintenance failed");
      }
    }
  );

  app.get("/api/bidrock/seller/inventory", isAuthenticated, async (req: Request, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ listings: await listBidRockSellerInventory(userId) });
    } catch (error) {
      respondError(res, error, "Seller inventory is temporarily unavailable");
    }
  });

  app.patch(
    "/api/bidrock/listings/:id/price",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const listingId = publicListingIdSchema.safeParse(req.params.id);
      const body = priceSchema.safeParse(req.body);
      if (!userId) return;
      if (!listingId.success || !body.success) {
        res.status(400).json({ message: "Enter a valid seller price and unit" });
        return;
      }
      const amountCents = normalizeBidRockAmountToCents(body.data.amount);
      if (!amountCents) {
        res.status(400).json({ message: "Enter a valid positive seller price" });
        return;
      }
      try {
        res.json(
          await setBidRockListingPrice({
            userId,
            listingId: listingId.data,
            unit: body.data.unit,
            amountCents,
          })
        );
      } catch (error) {
        respondError(res, error, "Seller price could not be saved");
      }
    }
  );

  app.delete(
    "/api/bidrock/listings/:id/price",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const listingId = publicListingIdSchema.safeParse(req.params.id);
      if (!userId) return;
      if (!listingId.success) {
        res.status(400).json({ message: "A valid listing is required" });
        return;
      }
      try {
        res.json(await clearBidRockListingPrice({ userId, listingId: listingId.data }));
      } catch (error) {
        respondError(res, error, "Seller price could not be cleared");
      }
    }
  );

  app.patch(
    "/api/bidrock/listings/:id/publication",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const listingId = publicListingIdSchema.safeParse(req.params.id);
      const body = z.object({ saleReady: z.boolean() }).strict().safeParse(req.body);
      if (!userId) return;
      if (!listingId.success || !body.success) {
        res.status(400).json({ message: "A valid listing and sale-ready choice are required" });
        return;
      }
      try {
        res.json(
          await setBidRockListingSaleReady({
            userId,
            listingId: listingId.data,
            saleReady: body.data.saleReady,
          })
        );
      } catch (error) {
        respondError(res, error, "Publication state could not be saved");
      }
    }
  );

  app.put(
    "/api/bidrock/listings/:id/saved",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const listingId = publicListingIdSchema.safeParse(req.params.id);
      const body = z.object({ saved: z.boolean() }).strict().safeParse(req.body);
      if (!userId) return;
      if (!listingId.success || !body.success) {
        res.status(400).json({ message: "A valid saved selection is required" });
        return;
      }
      try {
        res.json(
          await setBidRockSavedListing({
            userId,
            listingId: listingId.data,
            saved: body.data.saved,
          })
        );
      } catch (error) {
        respondError(res, error, "Saved selection could not be updated");
      }
    }
  );

  app.get("/api/bidrock/offers", isAuthenticated, async (req: Request, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const listingId = req.query.listingId
      ? publicListingIdSchema.safeParse(req.query.listingId)
      : null;
    if (listingId && !listingId.success) {
      res.status(400).json({ message: "A valid listing filter is required" });
      return;
    }
    try {
      res.json({ offers: await listBidRockOffers({ userId, listingId: listingId?.data }) });
    } catch (error) {
      respondError(res, error, "Offers are temporarily unavailable");
    }
  });

  app.post(
    "/api/bidrock/listings/:id/offers",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const listingId = publicListingIdSchema.safeParse(req.params.id);
      const body = offerSchema.safeParse(req.body);
      if (!userId) return;
      if (!listingId.success || !body.success) {
        res.status(400).json({ message: "Valid offer details are required" });
        return;
      }
      const key = idempotencyKey(req, body.data.idempotencyKey);
      const totalAmountCents = normalizeBidRockAmountToCents(body.data.totalAmount);
      if (!key || !totalAmountCents) {
        res.status(400).json({ message: "Offer total and idempotency key are required" });
        return;
      }
      try {
        res.status(201).json(
          await createBidRockOffer({
            userId,
            listingId: listingId.data,
            quantity: body.data.quantity,
            totalAmountCents,
            message: body.data.message,
            idempotencyKey: key,
          })
        );
      } catch (error) {
        respondError(res, error, "Offer could not be submitted");
      }
    }
  );

  app.post(
    "/api/bidrock/offers/:id/respond",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const offerId = uuidSchema.safeParse(req.params.id);
      const body = z
        .object({
          action: z.enum(["reject", "counter"]),
          totalAmount: z.union([z.number(), z.string()]).optional(),
          message: z.string().trim().max(1_000).nullable().optional(),
          idempotencyKey: z.string().trim().max(160).optional(),
        })
        .strict()
        .safeParse(req.body);
      if (!userId) return;
      if (!offerId.success || !body.success) {
        res.status(400).json({ message: "A valid offer response is required" });
        return;
      }
      try {
        const totalAmountCents =
          body.data.action === "counter"
            ? normalizeBidRockAmountToCents(body.data.totalAmount)
            : undefined;
        res.json(
          await respondToBidRockOffer({
            userId,
            offerId: offerId.data,
            action: body.data.action,
            totalAmountCents: totalAmountCents ?? undefined,
            message: body.data.message,
            idempotencyKey: idempotencyKey(req, body.data.idempotencyKey),
          })
        );
      } catch (error) {
        respondError(res, error, "Offer response could not be saved");
      }
    }
  );

  app.post(
    "/api/bidrock/offers/:id/accept",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const offerId = uuidSchema.safeParse(req.params.id);
      if (!userId) return;
      if (!offerId.success) {
        res.status(400).json({ message: "A valid offer is required" });
        return;
      }
      try {
        res.status(201).json(await acceptBidRockOffer({ userId, offerId: offerId.data }));
      } catch (error) {
        respondError(res, error, "Offer could not be accepted");
      }
    }
  );

  app.get("/api/bidrock/orders", isAuthenticated, async (req: Request, res: Response) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    try {
      res.json({ orders: await listBidRockOrders(userId) });
    } catch (error) {
      respondError(res, error, "Orders are temporarily unavailable");
    }
  });

  app.get(
    "/api/bidrock/provider/assignments",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      if (!userId) return;
      try {
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ assignments: await listBidRockProviderAssignments(userId) });
      } catch (error) {
        respondError(res, error, "Provider assignments are temporarily unavailable");
      }
    }
  );

  app.get("/api/bidrock/orders/:id", isAuthenticated, async (req: Request, res: Response) => {
    const userId = requireUser(req, res);
    const orderId = publicOrderIdSchema.safeParse(req.params.id);
    if (!userId) return;
    if (!orderId.success) {
      res.status(400).json({ message: "A valid order is required" });
      return;
    }
    try {
      res.json(await getBidRockOrderWorkspace({ userId, orderId: orderId.data }));
    } catch (error) {
      respondError(res, error, "Order is temporarily unavailable");
    }
  });

  app.post(
    "/api/bidrock/orders/:id/payment-readiness",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const orderId = publicOrderIdSchema.safeParse(req.params.id);
      if (!userId) return;
      if (!orderId.success) {
        res.status(400).json({ message: "A valid order is required" });
        return;
      }
      try {
        res.json(await markBidRockOrderPaymentReady({ userId, orderId: orderId.data }));
      } catch (error) {
        respondError(res, error, "Payment readiness could not be saved");
      }
    }
  );

  app.post(
    "/api/admin/bidrock/orders/:id/delegations",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const orderId = publicOrderIdSchema.safeParse(req.params.id);
      const body = z
        .object({
          providerUserId: z.string().trim().min(1).max(160).nullable().optional(),
          providerBusinessId: z.string().trim().min(1).max(160).nullable().optional(),
          handoffTypes: z.array(z.enum(BIDROCK_HANDOFF_TYPES)).min(1).max(4),
          status: z.enum(["active", "revoked"]).default("active"),
          expiresAt: z.string().datetime().nullable().optional(),
        })
        .strict()
        .superRefine((value, context) => {
          if (Boolean(value.providerUserId) === Boolean(value.providerBusinessId)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Exactly one delegated provider identity is required",
            });
          }
        })
        .safeParse(req.body);
      if (!userId) return;
      if (!orderId.success || !body.success) {
        res.status(400).json({
          message: body.success
            ? "A valid order is required"
            : body.error.issues[0]?.message || "Valid delegation details are required",
        });
        return;
      }
      try {
        res.json(await setBidRockOrderDelegation({ userId, orderId: orderId.data, ...body.data }));
      } catch (error) {
        respondError(res, error, "Order delegation could not be saved");
      }
    }
  );

  app.post(
    "/api/bidrock/orders/:id/handoffs",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const orderId = publicOrderIdSchema.safeParse(req.params.id);
      const body = z
        .object({
          handoffType: z.enum(BIDROCK_HANDOFF_TYPES),
          status: z.enum(["pending", "in_progress", "completed"]),
          providerName: z.string().trim().max(180).nullable().optional(),
          reference: z.string().trim().max(240).nullable().optional(),
          scheduledFor: z.string().datetime().nullable().optional(),
          responsibleBusinessId: z.string().trim().max(160).nullable().optional(),
          metadata: z.record(z.unknown()).optional(),
          evidence: z.record(z.unknown()).optional(),
          idempotencyKey: z.string().trim().max(160).optional(),
        })
        .strict()
        .safeParse(req.body);
      if (!userId) return;
      const key = body.success ? idempotencyKey(req, body.data.idempotencyKey) : "";
      if (!orderId.success || !body.success || !key) {
        res
          .status(400)
          .json({ message: "Valid handoff details and an idempotency key are required" });
        return;
      }
      try {
        res.status(201).json(
          await recordBidRockHandoff({
            userId,
            orderId: orderId.data,
            ...body.data,
            idempotencyKey: key,
          })
        );
      } catch (error) {
        respondError(res, error, "Handoff could not be saved");
      }
    }
  );

  app.post(
    "/api/bidrock/orders/:id/cancel",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const orderId = publicOrderIdSchema.safeParse(req.params.id);
      if (!userId) return;
      if (!orderId.success) {
        res.status(400).json({ message: "A valid order is required" });
        return;
      }
      try {
        res.json(await cancelBidRockOrder({ userId, orderId: orderId.data }));
      } catch (error) {
        respondError(res, error, "Order could not be cancelled");
      }
    }
  );

  app.patch(
    "/api/admin/bidrock/orders/:id/system-links",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const orderId = publicOrderIdSchema.safeParse(req.params.id);
      const body = z
        .object({
          canonicalMarketplaceTransactionId: z.string().trim().max(160).nullable().optional(),
          canonicalProcurementOrderId: z.string().trim().max(160).nullable().optional(),
        })
        .strict()
        .safeParse(req.body);
      if (!userId) return;
      if (!orderId.success || !body.success) {
        res.status(400).json({ message: "Valid canonical system links are required" });
        return;
      }
      try {
        res.json(await linkBidRockOrderSystems({ userId, orderId: orderId.data, ...body.data }));
      } catch (error) {
        respondError(res, error, "Canonical system links could not be saved");
      }
    }
  );

  app.post(
    "/api/admin/bidrock/orders/:id/payment-settled",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const orderId = publicOrderIdSchema.safeParse(req.params.id);
      if (!userId) return;
      if (!orderId.success) {
        res.status(400).json({ message: "A valid order is required" });
        return;
      }
      try {
        res.json(await recordBidRockPaymentSettlement({ userId, orderId: orderId.data }));
      } catch (error) {
        respondError(res, error, "ACH settlement could not be reconciled");
      }
    }
  );

  app.post(
    "/api/admin/bidrock/orders/:id/complete",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = requireUser(req, res);
      const orderId = publicOrderIdSchema.safeParse(req.params.id);
      if (!userId) return;
      if (!orderId.success) {
        res.status(400).json({ message: "A valid order is required" });
        return;
      }
      try {
        res.json(await completeBidRockOrder({ userId, orderId: orderId.data }));
      } catch (error) {
        respondError(res, error, "Order could not be completed");
      }
    }
  );

  app.get(`${BIDROCK_PUBLIC_ROUTE}/account`, (req, res) => {
    const profileSlug = String(req.query.profile || BIDROCK_DEFAULT_PROFILE_SLUG);
    res.redirect(302, buildBidRockSourceProfileAccountPath(profileSlug));
  });
}
