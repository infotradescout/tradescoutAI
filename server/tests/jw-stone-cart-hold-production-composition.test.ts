import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  holdInstances: [] as any[],
  registerHolds: vi.fn(),
  startExpiry: vi.fn(),
  rateLimitOptions: [] as any[],
  storeFactory: vi.fn(() => ({ kind: "postgres-store" })),
}));

vi.mock("express-rate-limit", () => ({
  rateLimit: (options: any) => {
    harness.rateLimitOptions.push(options);
    return (_req: any, _res: any, next: any) => next();
  },
}));
vi.mock("../db", () => ({ pool: { kind: "fixture-pool" }, db: {} }));
vi.mock("../auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../schemaPreflight", () => ({
  requireCriticalSchema: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../utils/postgresRateLimitStore", () => ({
  createPostgresRateLimitStore: harness.storeFactory,
}));
vi.mock("../services/jwStoneCartHolds", () => ({
  JwStoneCartHolds: class {
    constructor(public readonly database: any) {
      harness.holdInstances.push(this);
    }
  },
}));
vi.mock("../services/jwStoneCartHoldWorker", () => ({
  startJwStoneCartHoldExpiry: harness.startExpiry,
}));
vi.mock("../routes/jw-stone-cart-holds", () => ({
  registerJwStoneCartHoldRoutes: harness.registerHolds,
}));
vi.mock("../routes/jw-stone-features", () => ({
  registerJwStoneFeatureRoutes: vi.fn(),
}));
vi.mock("../services/jwStoneDrivePricing", () => ({
  getJwStonePricingSnapshot: vi.fn(async () => ({ sourceUpdatedAt: "fixture", prices: [] })),
}));
vi.mock("../services/jwStonePricingAccess", () => ({
  resolveJwStonePricingAccess: vi.fn(async () => "member"),
}));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: vi.fn(async () => ({ businessId: "jw-business" })),
  listSellerStoneInventory: vi.fn(async () => []),
}));
vi.mock("../services/jwStoneCartAvailability", () => ({
  loadJwStoneCartAvailability: vi.fn(async () => new Map()),
}));

describe("JW Stone production cart-hold composition", () => {
  let register: (app: express.Express) => void;

  beforeAll(async () => {
    vi.stubEnv("NODE_ENV", "production");
    ({ registerJwStoneMemberPricingRoutes: register } = await import(
      "../routes/jw-stone-member-pricing"
    ));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("mounts the full mutation router with persistent limiting and starts expiry once", () => {
    const app = express();
    register(app);
    register(app);

    expect(harness.holdInstances).toHaveLength(1);
    expect(harness.registerHolds).toHaveBeenCalledTimes(2);
    const deps = harness.registerHolds.mock.calls[0][1];
    expect(deps.holds).toBe(harness.holdInstances[0]);
    expect(typeof deps.requireWriteIntent).toBe("function");
    expect(typeof deps.mutationLimiter).toBe("function");

    expect(harness.rateLimitOptions).toHaveLength(1);
    expect(harness.rateLimitOptions[0]).toMatchObject({
      windowMs: 10 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
    });
    expect(harness.rateLimitOptions[0].keyGenerator({
      user: { id: "buyer-a" },
      ip: "127.0.0.1",
    })).toBe("u:buyer-a");
    expect(harness.storeFactory).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "jw_stone_cart_hold_mutation" })
    );

    expect(harness.startExpiry).toHaveBeenCalledTimes(1);
    expect(harness.startExpiry).toHaveBeenCalledWith(harness.holdInstances[0]);
  });

  it("uses the real production write-intent guard to reject cross-origin mutations", () => {
    const deps = harness.registerHolds.mock.calls[0][1];
    const next = vi.fn();
    const sameOriginResponse = { status: vi.fn(), json: vi.fn() } as any;
    deps.requireWriteIntent(
      {
        protocol: "https",
        get: (name: string) =>
          name.toLowerCase() === "origin"
            ? "https://thetradescout.com"
            : name.toLowerCase() === "host"
              ? "thetradescout.com"
              : undefined,
      } as any,
      sameOriginResponse,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    deps.requireWriteIntent(
      {
        protocol: "https",
        get: (name: string) =>
          name.toLowerCase() === "origin"
            ? "https://attacker.example"
            : name.toLowerCase() === "host"
              ? "thetradescout.com"
              : undefined,
      } as any,
      { status, json } as any,
      vi.fn()
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "same_origin_required" })
    );
  });
});
