import { readFileSync } from "node:fs";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  JW_STONE_CART_HOLD_PATH,
  type JwStoneCartHoldReceipt,
} from "@shared/jwStoneCartHolds";
import { registerJwStoneCartHoldRoutes } from "../routes/jw-stone-cart-holds";

const reservationId = `jwh_${"a".repeat(32)}`;
const inventoryPublicId = `stone_${"b".repeat(32)}`;
const receipt: JwStoneCartHoldReceipt = {
  reservationId,
  status: "active",
  expiresAt: "2026-09-19T15:30:00.000Z",
  serverTime: "2026-09-19T15:00:00.000Z",
  currency: "USD",
  materialSubtotalCents: 15000,
  paymentStatus: "not_started",
  readyForCheckout: false,
  fulfillment: { method: "pickup" },
  deliveryFeeCents: null,
  estimatedDeliveryDate: null,
  lines: [
    {
      inventoryPublicId,
      materialName: "Honey Onyx",
      quantity: 1,
      unitRateCents: 300,
      oneSlabTotalCents: 15000,
      lineTotalCents: 15000,
      pricingTier: "slab",
    },
  ],
};

function fixture(access: "member" | "internal" | "none" = "member") {
  const holds = {
    reserve: vi.fn(async () => receipt),
    get: vi.fn(async () => receipt),
    recover: vi.fn(async () => ({
      reservationId,
      status: "active" as const,
      expiresAt: receipt.expiresAt,
      serverTime: receipt.serverTime,
      totalSlabs: 1,
      lines: [{ inventoryPublicId, materialName: "Honey Onyx", quantity: 1 }],
    })),
    release: vi.fn(async () => ({ reservationId, status: "released" as const })),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: req.get("x-fixture-viewer") || "buyer" } as any;
    next();
  });
  const authenticate = (req: Request, res: Response, next: NextFunction) =>
    req.user ? next() : res.status(401).json({ message: "Authentication required" });
  const requireWriteIntent = (req: Request, res: Response, next: NextFunction) =>
    req.get("x-write-intent") === "same-origin"
      ? next()
      : res.status(403).json({ code: "same_origin_required" });
  registerJwStoneCartHoldRoutes(app, {
    holds: holds as any,
    authenticate,
    requireSchema: (_req, _res, next) => next(),
    requireWriteIntent,
    mutationLimiter: (_req, _res, next) => next(),
    target: async () => ({ businessId: "jw-business" }),
    access: async () => access,
    pricing: async () => ({ sourceUpdatedAt: "2026-09-19T15:00:00.000Z", prices: [] }),
  });
  return { app, holds };
}

describe("JW Stone cart hold HTTP mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires write intent and member access before reserving stock", async () => {
    const { app, holds } = fixture("member");
    const body = {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      lines: [{ inventoryPublicId, quantity: 1 }],
      expectedSubtotalCents: 15000,
      fulfillment: { method: "pickup" },
    };

    const blocked = await request(app).post(JW_STONE_CART_HOLD_PATH).send(body);
    expect(blocked.status).toBe(403);
    expect(holds.reserve).not.toHaveBeenCalled();

    const allowed = await request(app)
      .post(JW_STONE_CART_HOLD_PATH)
      .set("x-write-intent", "same-origin")
      .send(body);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual(receipt);
    expect(allowed.headers["cache-control"]).toBe("private, no-store");
    expect(holds.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerUserId: "buyer",
        sellerBusinessId: "jw-business",
        request: body,
      })
    );
  });

  it("does not let internal or nonmember viewers create buyer reservations", async () => {
    for (const access of ["internal", "none"] as const) {
      const { app, holds } = fixture(access);
      const response = await request(app)
        .post(JW_STONE_CART_HOLD_PATH)
        .set("x-write-intent", "same-origin")
        .send({
          idempotencyKey: "11111111-1111-4111-8111-111111111111",
          lines: [{ inventoryPublicId, quantity: 1 }],
          expectedSubtotalCents: 15000,
          fulfillment: { method: "pickup" },
        });
      expect(response.status).toBe(403);
      expect(holds.reserve).not.toHaveBeenCalled();
    }
  });

  it("lets the original owner release stock after membership loss and rejects replacement data", async () => {
    const { app, holds } = fixture("none");
    const path = `${JW_STONE_CART_HOLD_PATH}/${reservationId}/release`;

    const blocked = await request(app).post(path).send({});
    expect(blocked.status).toBe(403);
    expect(holds.release).not.toHaveBeenCalled();

    const invalid = await request(app)
      .post(path)
      .set("x-write-intent", "same-origin")
      .send({ quantity: 2 });
    expect(invalid.status).toBe(400);
    expect(holds.release).not.toHaveBeenCalled();

    const released = await request(app)
      .post(path)
      .set("x-write-intent", "same-origin")
      .send({});
    expect(released.status).toBe(200);
    expect(released.body).toEqual({ reservationId, status: "released" });
    expect(holds.release).toHaveBeenCalledWith({
      buyerUserId: "buyer",
      sellerBusinessId: "jw-business",
      reservationId,
    });
  });

  it("keeps operation recovery read-only and outside the write-intent guard", async () => {
    const { app, holds } = fixture("none");
    const operationId = "11111111-1111-4111-8111-111111111111";
    const response = await request(app).get(
      `${JW_STONE_CART_HOLD_PATH}/operations/${operationId}`
    );
    expect(response.status).toBe(200);
    expect(response.body.viewerId).toBe("buyer");
    expect(response.body.hold).toMatchObject({ reservationId, totalSlabs: 1 });
    expect(JSON.stringify(response.body)).not.toMatch(/subtotal|rate|price|payment|checkout/i);
    expect(holds.recover).toHaveBeenCalledWith({
      buyerUserId: "buyer",
      sellerBusinessId: "jw-business",
      operationId,
    });
  });
});

describe("JW Stone cart hold production composition", () => {
  it("mounts guarded mutations and starts the expiry worker only in production", () => {
    const source = readFileSync("server/routes/jw-stone-member-pricing.ts", "utf8");
    expect(source).toContain("registerJwStoneCartHoldRoutes(app, {");
    expect(source).toContain("requireWriteIntent: requireJwStoneCartHoldWriteIntent");
    expect(source).toContain("mutationLimiter: jwStoneCartHoldMutationLimiter");
    expect(source).toContain("createPostgresRateLimitStore");
    expect(source).toContain('process.env.NODE_ENV === "production"');
    expect(source).toContain("startJwStoneCartHoldExpiry(jwStoneCartHolds)");
    expect(source).not.toContain("registerJwStoneCartHoldRecoveryRoutes");
  });
});
