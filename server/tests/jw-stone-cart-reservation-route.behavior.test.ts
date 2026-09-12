import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reserve = vi.hoisted(() => vi.fn());
const access = vi.hoisted(() => vi.fn());

vi.mock("../auth", () => ({
  isAuthenticated: (req: any, res: any, next: any) =>
    req.user ? next() : res.status(401).json({ message: "Authentication required" }),
}));
vi.mock("../schemaPreflight", () => ({
  requireCriticalSchema: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../services/jwStonePricingAccess", () => ({
  resolveJwStonePricingAccess: access,
}));
vi.mock("../services/jwStoneDrivePricing", () => ({
  getJwStonePricingSnapshot: async () => ({
    sourceUpdatedAt: "2026-09-12T00:00:00.000Z",
    prices: [],
  }),
}));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async () => ({
    profileId: "jw-profile",
    profileSlug: "jw-stone",
    profileStatus: "active",
    ownerUserId: "jw-owner",
    businessId: "jw-business",
    businessOwnerUserId: "jw-owner",
  }),
  listSellerStoneInventory: async () => [],
}));
vi.mock("../services/jwStoneBidRockReservation", () => ({
  reserveJwStoneMemberCart: reserve,
}));

import { registerJwStoneMemberPricingRoutes } from "../routes/jw-stone-member-pricing";

describe("JW Stone member cart reservation route", () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const viewer = req.get("x-viewer");
    if (viewer) req.user = { id: viewer } as any;
    next();
  });
  registerJwStoneMemberPricingRoutes(app);

  beforeEach(() => {
    access.mockReset();
    reserve.mockReset();
    access.mockImplementation(async ({ userId }: { userId: string }) =>
      userId === "member" ? "member" : userId === "internal" ? "internal" : "none"
    );
    reserve.mockResolvedValue({
      reservationKey: "reservation-key-1",
      currency: "USD",
      subtotalCents: 125000,
      expiresAt: "2026-09-12T04:00:00.000Z",
      paymentStatus: "not_started",
      fulfillment: {
        method: "delivery",
        postalCode: "32505",
        destinationType: "business",
        freightQuoteStatus: "pending_quote",
        deliveryEtaStatus: "pending_quote",
      },
      orders: [],
    });
  });

  const body = {
    lines: [{ inventoryPublicId: `stone_${"a".repeat(32)}`, quantity: 2 }],
    fulfillment: { method: "delivery", postalCode: "32505", destinationType: "business" },
    reservationKey: "reservation-key-1",
  };

  it("rejects guests before reservation logic", async () => {
    const response = await request(app)
      .post("/api/u/jw-stone/member-pricing/cart-reservations")
      .send(body);
    expect(response.status).toBe(401);
    expect(reserve).not.toHaveBeenCalled();
  });

  it("rejects nonmembers and internal-only pricing viewers", async () => {
    for (const viewer of ["nonmember", "internal"]) {
      const response = await request(app)
        .post("/api/u/jw-stone/member-pricing/cart-reservations")
        .set("x-viewer", viewer)
        .send(body);
      expect(response.status).toBe(403);
    }
    expect(reserve).not.toHaveBeenCalled();
  });

  it("requires truthful delivery destination inputs", async () => {
    const response = await request(app)
      .post("/api/u/jw-stone/member-pricing/cart-reservations")
      .set("x-viewer", "member")
      .send({
        ...body,
        fulfillment: { method: "delivery", postalCode: "not-a-zip", destinationType: "business" },
      });
    expect(response.status).toBe(400);
    expect(reserve).not.toHaveBeenCalled();
  });

  it("passes only member-authorized physical IDs, fulfillment intent, and server pricing to the hold service", async () => {
    const response = await request(app)
      .post("/api/u/jw-stone/member-pricing/cart-reservations")
      .set("x-viewer", "member")
      .send(body);
    expect(response.status).toBe(201);
    expect(response.body.checkoutStatus).toBe("inventory_reserved");
    expect(response.body.paymentStatus).toBe("not_started");
    expect(response.body.fulfillment.freightQuoteStatus).toBe("pending_quote");
    expect(reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerUserId: "member",
        sellerBusinessId: "jw-business",
        lines: body.lines,
        fulfillment: body.fulfillment,
        reservationKey: body.reservationKey,
        pricingSnapshot: expect.objectContaining({ sourceUpdatedAt: "2026-09-12T00:00:00.000Z" }),
      })
    );
  });
});
