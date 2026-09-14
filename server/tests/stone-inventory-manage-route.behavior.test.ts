import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({
  list: vi.fn(),
  upsert: vi.fn(),
  retire: vi.fn(),
  publish: vi.fn(),
  arrival: vi.fn(),
}));
vi.mock("../db", () => ({ pool: { query: vi.fn() }, db: {} }));
vi.mock("../auth", () => ({
  isAuthenticated: (req: any, res: any, next: any) => (req.user ? next() : res.sendStatus(401)),
}));
vi.mock("../schemaPreflight", () => ({
  requireCriticalSchema: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../routes/profiles", () => ({
  getPublicProfileTrustContext: async (slug: string) => ({
    profileSlug: slug,
    businessId: slug === "jw-stone" ? "jw-business" : "foreign-business",
  }),
}));
vi.mock("../services/jwStoneConfirmedStock", () => ({ importJwStoneConfirmedStock: vi.fn() }));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: async (slug: string) => ({
    profileSlug: slug,
    businessId: slug === "jw-stone" ? "jw-business" : "foreign-business",
    businessOwnerUserId: "owner",
  }),
  hasStoneInventoryCapability: async ({ userId, target }: any) =>
    target.businessId === "jw-business" &&
    ["owner", "reader", "writer", "publisher", "suspended"].includes(userId),
  listSellerStoneInventory: calls.list,
  listPublicCurrentStoneInventory: async () => [],
  upsertCurrentStoneInventory: calls.upsert,
  retireStoneInventory: calls.retire,
  setStoneInventorySaleReady: calls.publish,
  defaultStoneInventoryConfirmationWindow: () => ({
    lastConfirmedAt: "2026-09-08T12:00:00.000Z",
    confirmationExpiresAt: "2026-10-08T12:00:00.000Z",
  }),
}));
vi.mock("../services/stoneNewArrivalsService", () => ({
  listPublicStoneNewArrivals: async () => [],
  listSellerStoneNewArrivalIds: async () => [],
  setStoneInventoryNewArrival: calls.arrival,
}));
vi.mock("../services/bidrockService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/bidrockService")>();
  return {
    ...actual,
    getBidRockViewerContext: async (userId: string) => ({
      userId,
      admin: false,
      verifiedBusiness: true,
      accountStatus: userId === "suspended" ? "suspended" : "active",
      writableInventoryBusinessIds: new Set(
        ["owner", "writer", "suspended"].includes(userId) ? ["jw-business"] : []
      ),
      publishableInventoryBusinessIds: new Set(
        ["owner", "publisher", "suspended"].includes(userId) ? ["jw-business"] : []
      ),
    }),
    syncBidRockStoneInventory: vi.fn(),
  };
});
import { registerStoneInventoryRoutes } from "../routes/stone-inventory";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const id = req.get("x-fixture-viewer");
  if (id) req.user = { id } as any;
  next();
});
registerStoneInventoryRoutes(app);
const publicId = `stone_${"a".repeat(32)}`;
const stock = {
  publicId,
  materialSlug: "test-stone",
  materialName: "Test stone",
  materialClass: "natural_stone",
  materialFamily: "granite",
  assetKind: "bundle",
  quantity: 3,
  unit: "slabs",
  dimensions: {},
  imageUrls: [],
  finishQuantities: [],
};

describe("physical inventory manager authority over HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.list.mockResolvedValue([{ id: publicId, materialName: "Test stone" }]);
    calls.upsert.mockResolvedValue({ id: publicId, isSaleReady: false });
    calls.retire.mockResolvedValue(true);
  });
  it("denies guests and non-managers before reading private lots", async () => {
    expect((await request(app).get("/api/u/jw-stone/stone-inventory/manage")).status).toBe(401);
    expect(
      (
        await request(app)
          .get("/api/u/jw-stone/stone-inventory/manage")
          .set("x-fixture-viewer", "outsider")
      ).status
    ).toBe(403);
    expect(calls.list).not.toHaveBeenCalled();
  });
  it.each([
    ["reader", false, false],
    ["writer", true, false],
    ["publisher", false, true],
    ["owner", true, true],
    ["suspended", false, false],
  ])("returns exact independent capabilities for %s", async (viewer, write, publish) => {
    const response = await request(app)
      .get("/api/u/jw-stone/stone-inventory/manage")
      .set("x-fixture-viewer", String(viewer));
    expect(response.status).toBe(200);
    expect(response.body.capabilities).toEqual({ write, publish });
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });
  it("does not expose management capabilities or private lots on public reads", async () => {
    for (const path of ["current", "new-arrivals"]) {
      const response = await request(app).get(`/api/u/jw-stone/stone-inventory/${path}`);
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
      expect(response.body.capabilities).toBeUndefined();
    }
    expect(calls.list).not.toHaveBeenCalled();
  });
  it.each(["reader", "suspended", "outsider"])(
    "rechecks %s authority on every mutation",
    async (viewer) => {
      const base = "/api/u/jw-stone/stone-inventory/current";
      const responses = await Promise.all([
        request(app).post(base).set("x-fixture-viewer", viewer).send(stock),
        request(app).delete(`${base}/${publicId}`).set("x-fixture-viewer", viewer),
        request(app)
          .patch(`${base}/${publicId}/publication`)
          .set("x-fixture-viewer", viewer)
          .send({ saleReady: true }),
        request(app)
          .patch(`${base}/${publicId}/new-arrival`)
          .set("x-fixture-viewer", viewer)
          .send({ showAsNewArrival: true }),
      ]);
      expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403]);
      for (const action of [calls.upsert, calls.retire, calls.publish, calls.arrival])
        expect(action).not.toHaveBeenCalled();
    }
  );
  it("rejects a foreign business route and a forged business payload", async () => {
    expect(
      (
        await request(app)
          .post("/api/u/another-seller/stone-inventory/current")
          .set("x-fixture-viewer", "owner")
          .send(stock)
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/u/jw-stone/stone-inventory/current")
          .set("x-fixture-viewer", "owner")
          .send({ ...stock, businessId: "foreign-business" })
      ).status
    ).toBe(400);
    expect(calls.upsert).not.toHaveBeenCalled();
  });
  it("passes the exact existing publicId and server-resolved holder on re-confirmation", async () => {
    const response = await request(app)
      .post("/api/u/jw-stone/stone-inventory/current")
      .set("x-fixture-viewer", "writer")
      .send(stock);
    expect(response.status).toBe(200);
    expect(calls.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ businessId: "jw-business" }),
      expect.objectContaining({ publicId, quantity: 3 })
    );
    expect(response.body).toMatchObject({ buyerVisible: false, publicationRequired: true });
    expect(
      (
        await request(app)
          .patch(`/api/u/jw-stone/stone-inventory/current/${publicId}/publication`)
          .set("x-fixture-viewer", "writer")
          .send({ saleReady: true })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/u/jw-stone/stone-inventory/current")
          .set("x-fixture-viewer", "publisher")
          .send(stock)
      ).status
    ).toBe(403);
  });
});
