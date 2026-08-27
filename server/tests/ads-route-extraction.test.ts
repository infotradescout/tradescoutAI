import express, { type RequestHandler } from "express";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { registerAdRoutes, type AdRoutesStorage } from "../routes/ads";

const routeInventory = [
  ["GET", "/api/ads/site-visit", 1],
  ["POST", "/api/ads/track-impression", 1],
  ["POST", "/api/ads/track-click", 1],
  ["POST", "/api/ads/feedback", 2],
  ["POST", "/api/ads/save", 2],
  ["GET", "/api/saved-ads", 2],
  ["DELETE", "/api/ads/save/:adId", 2],
] as const;

function createStorage(overrides: Partial<AdRoutesStorage> = {}): AdRoutesStorage {
  return {
    getTargetedAd: vi.fn().mockResolvedValue(null),
    normalizeAdLinkForUser: vi.fn().mockResolvedValue(null),
    incrementAdImpressions: vi.fn().mockResolvedValue(undefined),
    trackAdEvent: vi.fn().mockResolvedValue(undefined),
    incrementAdClicks: vi.fn().mockResolvedValue(undefined),
    submitAdFeedback: vi.fn().mockResolvedValue(undefined),
    saveAdForUser: vi.fn().mockResolvedValue({ id: "saved-1" }),
    getSavedAdsForUser: vi.fn().mockResolvedValue([]),
    removeSavedAd: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as AdRoutesStorage;
}

const testAuthentication: RequestHandler = (req: any, res, next) => {
  const userId = req.header("x-test-user");
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  req.user = { claims: { sub: userId } };
  next();
};

function createApp(storage: AdRoutesStorage) {
  const app = express();
  app.use(express.json());
  registerAdRoutes(app, { storage, isAuthenticated: testAuthentication });
  return app;
}

describe("ad route extraction contract", () => {
  it("registers the exact method, path, and middleware order", () => {
    const registrations: Array<{ method: string; path: string; handlers: unknown[] }> = [];
    const app = Object.fromEntries(
      ["get", "post", "delete"].map((method) => [
        method,
        (path: string, ...handlers: unknown[]) => {
          registrations.push({ method: method.toUpperCase(), path, handlers });
        },
      ])
    );

    registerAdRoutes(app as any, {
      storage: createStorage(),
      isAuthenticated: testAuthentication,
    });

    expect(
      registrations.map(({ method, path, handlers }) => [method, path, handlers.length])
    ).toEqual(routeInventory);
    for (const registration of registrations.filter(({ handlers }) => handlers.length === 2)) {
      expect(registration.handlers[0]).toBe(testAuthentication);
    }
  });

  it("has one root registration at the original route-order boundary and no inline copies", () => {
    const root = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    const module = fs.readFileSync(path.resolve("server/routes/ads.ts"), "utf8");

    expect(root.match(/import \{ registerAdRoutes \} from "\.\/routes\/ads";/g)).toHaveLength(1);
    expect(root.match(/registerAdRoutes\(app, \{ storage, isAuthenticated \}\);/g)).toHaveLength(1);
    for (const [, routePath] of routeInventory) {
      expect(root).not.toContain(`"${routePath}"`);
      expect(module).toContain(`"${routePath}"`);
    }

    const providerStanding = root.indexOf('app.get("/api/providers/standing"');
    const registration = root.indexOf("registerAdRoutes(app, { storage, isAuthenticated });");
    const adminReminders = root.indexOf('app.post("/api/admin/trigger-reminders"');
    expect(providerStanding).toBeGreaterThan(-1);
    expect(registration).toBeGreaterThan(providerStanding);
    expect(adminReminders).toBeGreaterThan(registration);
  });

  it("keeps the extracted module behind a narrow acyclic dependency boundary", () => {
    const module = fs.readFileSync(path.resolve("server/routes/ads.ts"), "utf8");
    expect(module).toContain('import type { IStorage } from "../storage/contracts";');
    expect(module).not.toMatch(/from ["']\.\.\/storage["']/);
    expect(module).not.toMatch(/from ["']\.\.\/auth["']/);
    expect(module).not.toMatch(/from ["']\.\.\/routes["']/);
    expect(module).not.toMatch(/from ["']\.\/ads["']/);
  });
});

describe("ad route behavior", () => {
  it("returns 404 when no site-visit ad is available", async () => {
    const response = await request(createApp(createStorage())).get("/api/ads/site-visit");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "No ads available" });
  });

  it("returns a site-visit ad with its user-normalized link", async () => {
    const getTargetedAd = vi
      .fn()
      .mockResolvedValue({ id: "ad-1", linkUrl: "/raw", isAffiliate: true });
    const normalizeAdLinkForUser = vi.fn().mockResolvedValue("/normalized?ref=user-1");
    const response = await request(
      createApp(createStorage({ getTargetedAd, normalizeAdLinkForUser }))
    )
      .get("/api/ads/site-visit?userType=contractor&state=FL&county=Escambia")
      .set("x-test-user", "user-1");

    expect(response.status).toBe(200);
    expect(response.body.linkUrl).toBe("/normalized?ref=user-1");
    expect(getTargetedAd).toHaveBeenCalledWith({
      audience: "contractor",
      state: "FL",
      county: "Escambia",
      minCommunityScore: 40,
    });
    expect(normalizeAdLinkForUser).toHaveBeenCalledWith({
      linkUrl: "/raw",
      isAffiliate: true,
      userId: null,
    });
  });

  it.each(["track-impression", "track-click"])("rejects %s without adId", async (route) => {
    const response = await request(createApp(createStorage())).post(`/api/ads/${route}`).send({});
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "adId is required" });
  });

  it("records impression and click counters plus event context", async () => {
    const storage = createStorage();
    const app = createApp(storage);
    const impression = await request(app)
      .post("/api/ads/track-impression")
      .send({ adId: "ad-1", source: "site_visit" });
    const click = await request(app)
      .post("/api/ads/track-click")
      .send({ adId: "ad-1", source: "scout" });

    expect(impression.status).toBe(200);
    expect(click.status).toBe(200);
    expect(storage.incrementAdImpressions).toHaveBeenCalledWith("ad-1");
    expect(storage.incrementAdClicks).toHaveBeenCalledWith("ad-1");
    expect(storage.trackAdEvent).toHaveBeenNthCalledWith(1, {
      adId: "ad-1",
      eventType: "impression",
      source: "site_visit",
      userId: null,
    });
    expect(storage.trackAdEvent).toHaveBeenNthCalledWith(2, {
      adId: "ad-1",
      eventType: "click",
      source: "scout",
      userId: null,
    });
  });

  it("enforces feedback authentication and input", async () => {
    const app = createApp(createStorage());
    expect((await request(app).post("/api/ads/feedback").send({})).status).toBe(401);
    expect(
      (await request(app).post("/api/ads/feedback").set("x-test-user", "user-1").send({})).status
    ).toBe(400);
  });

  it("records valid feedback and fails soft on storage errors", async () => {
    const submitAdFeedback = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("db"));
    const app = createApp(createStorage({ submitAdFeedback }));
    const payload = { adId: "ad-1", rating: "helpful", source: "saved" };
    const success = await request(app)
      .post("/api/ads/feedback")
      .set("x-test-user", "user-1")
      .send(payload);
    const failSoft = await request(app)
      .post("/api/ads/feedback")
      .set("x-test-user", "user-1")
      .send(payload);

    expect(success.status).toBe(200);
    expect(success.body).toEqual({ success: true });
    expect(failSoft.status).toBe(200);
    expect(failSoft.body).toEqual({ success: false });
    expect(submitAdFeedback).toHaveBeenCalledWith({ ...payload, userId: "user-1" });
  });

  it("enforces authentication for save, list, and delete", async () => {
    const app = createApp(createStorage());
    expect((await request(app).post("/api/ads/save").send({ adId: "ad-1" })).status).toBe(401);
    expect((await request(app).get("/api/saved-ads")).status).toBe(401);
    expect((await request(app).delete("/api/ads/save/ad-1")).status).toBe(401);
  });

  it("saves, lists with normalized links, and removes saved ads", async () => {
    const storage = createStorage({
      saveAdForUser: vi.fn().mockResolvedValue({ id: "saved-1", adId: "ad-1" } as any),
      getSavedAdsForUser: vi
        .fn()
        .mockResolvedValue([{ id: "ad-1", linkUrl: "/raw", isAffiliate: true } as any]),
      normalizeAdLinkForUser: vi.fn().mockResolvedValue("/normalized"),
    });
    const app = createApp(storage);
    const save = await request(app)
      .post("/api/ads/save")
      .set("x-test-user", "user-1")
      .send({ adId: "ad-1" });
    const list = await request(app).get("/api/saved-ads").set("x-test-user", "user-1");
    const remove = await request(app).delete("/api/ads/save/ad-1").set("x-test-user", "user-1");

    expect(save.status).toBe(200);
    expect(list.status).toBe(200);
    expect(list.body[0].linkUrl).toBe("/normalized");
    expect(remove.status).toBe(204);
    expect(storage.saveAdForUser).toHaveBeenCalledWith("user-1", "ad-1");
    expect(storage.removeSavedAd).toHaveBeenCalledWith("user-1", "ad-1");
  });
});
