import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { requireJwStoneCartHoldWriteIntent } from "../utils/jwStoneCartHoldWriteIntent";

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

const originCases: Array<[
  string, string | undefined, string, string, Record<string, string>, boolean
]> = [
  ["custom domain", "https://jwstonelogistics.com", "jwstonelogistics.com", "https", {}, true],
  ["TradeScout domain", "https://thetradescout.com", "thetradescout.com", "https", {}, true],
  ["TLS proxy", "https://jwstonelogistics.com", "jwstonelogistics.com", "http", { "x-forwarded-proto": "https" }, true],
  ["proxy proto list", "https://jwstonelogistics.com", "jwstonelogistics.com", "http", { "x-forwarded-proto": "https, http" }, true],
  ["case normalization", "https://JWSTONELOGISTICS.COM", "JWSTONELOGISTICS.COM", "https", {}, true],
  ["default HTTPS port", "https://jwstonelogistics.com:443", "jwstonelogistics.com:443", "https", {}, true],
  ["equivalent default port", "https://jwstonelogistics.com", "jwstonelogistics.com:443", "https", {}, true],
  ["nondefault same port", "https://jwstonelogistics.com:8443", "jwstonelogistics.com:8443", "https", {}, true],
  ["local HTTP", "http://127.0.0.1:3000", "127.0.0.1:3000", "http", {}, true],
  ["IPv6 HTTP", "http://[::1]:3000", "[::1]:3000", "http", {}, true],
  ["forged forwarded host cannot override Host", "https://jwstonelogistics.com", "jwstonelogistics.com", "https", { "x-forwarded-host": "attacker.example" }, true],
  ["missing origin", undefined, "jwstonelogistics.com", "https", {}, false],
  ["opaque origin", "null", "jwstonelogistics.com", "https", {}, false],
  ["cross origin", "https://attacker.example", "jwstonelogistics.com", "https", {}, false],
  ["same-site sibling", "https://shop.jwstonelogistics.com", "jwstonelogistics.com", "https", {}, false],
  ["insecure scheme", "http://jwstonelogistics.com", "jwstonelogistics.com", "https", {}, false],
  ["port mismatch", "https://jwstonelogistics.com:8443", "jwstonelogistics.com", "https", {}, false],
  ["multiple origins", "https://jwstonelogistics.com, https://attacker.example", "jwstonelogistics.com", "https", {}, false],
  ["path forbidden", "https://jwstonelogistics.com/cart", "jwstonelogistics.com", "https", {}, false],
  ["query forbidden", "https://jwstonelogistics.com?cart=1", "jwstonelogistics.com", "https", {}, false],
  ["fragment forbidden", "https://jwstonelogistics.com#cart", "jwstonelogistics.com", "https", {}, false],
  ["username forbidden", "https://buyer@jwstonelogistics.com", "jwstonelogistics.com", "https", {}, false],
  ["password forbidden", "https://buyer:password@jwstonelogistics.com", "jwstonelogistics.com", "https", {}, false],
  ["missing Host", "https://jwstonelogistics.com", "", "https", {}, false],
  ["path in Host", "https://jwstonelogistics.com", "jwstonelogistics.com/cart", "https", {}, false],
  ["whitespace in Host", "https://jwstonelogistics.com", "jwstone logistics.com", "https", {}, false],
  ["forwarded host spoof", "https://attacker.example", "jwstonelogistics.com", "https", { "x-forwarded-host": "attacker.example" }, false],
  ["invalid proxy protocol", "https://jwstonelogistics.com", "jwstonelogistics.com", "http", { "x-forwarded-proto": "ftp" }, false],
  ["HTTPS against plain HTTP", "https://jwstonelogistics.com", "jwstonelogistics.com", "http", {}, false],
  ["empty origin", "", "jwstonelogistics.com", "https", {}, false],
  ["relative origin", "//jwstonelogistics.com", "jwstonelogistics.com", "https", {}, false],
  ["FTP origin", "ftp://jwstonelogistics.com", "jwstonelogistics.com", "https", {}, false],
];

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
    expect(deps.requireWriteIntent).toBe(requireJwStoneCartHoldWriteIntent);
    expect(typeof deps.mutationLimiter).toBe("function");

    expect(harness.rateLimitOptions).toHaveLength(1);
    expect(harness.rateLimitOptions[0]).toMatchObject({
      windowMs: 10 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const mutationKey = harness.rateLimitOptions[0].keyGenerator;
    expect(mutationKey({
      user: { id: "buyer-a" },
      ip: "127.0.0.1",
    })).toBe("u:buyer-a");
    expect(mutationKey({
      user: { id: "buyer-a" },
      ip: "203.0.113.44",
    })).toBe("u:buyer-a");
    expect(mutationKey({
      user: { id: "buyer-b" },
      ip: "127.0.0.1",
    })).toBe("u:buyer-b");
    expect(harness.storeFactory).toHaveBeenCalledWith(
      expect.objectContaining({ prefix: "jw_stone_cart_hold_mutation" })
    );

    expect(harness.startExpiry).toHaveBeenCalledTimes(1);
    expect(harness.startExpiry).toHaveBeenCalledWith(harness.holdInstances[0]);
  });

  it.each(originCases)(
    "uses the real production origin guard: %s",
    (_name, origin, host, protocol, extra, allowed) => {
      const app = express();
      register(app);
      const deps = harness.registerHolds.mock.calls.at(-1)![1];
      expect(deps.requireWriteIntent).toBe(requireJwStoneCartHoldWriteIntent);
      const headers: Record<string, string | undefined> = { host, origin, ...extra };
      const next = vi.fn();
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      deps.requireWriteIntent(
        { protocol, headers, get: (name: string) => headers[name.toLowerCase()] },
        res,
        next
      );
      expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
      if (allowed) {
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
      } else {
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ code: "same_origin_required" })
        );
      }
    }
  );
});
