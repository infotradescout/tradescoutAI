import express, { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  registerPublicHeatmapRoutes,
  type PublicHeatmapStorage,
} from "../routes/public-heatmap";

function createStorage(rows: unknown[] = []): PublicHeatmapStorage {
  return { getLocalityHeatmapData: vi.fn().mockResolvedValue(rows) };
}

function createNamespacedApp(storage: PublicHeatmapStorage) {
  const app = express();
  registerPublicHeatmapRoutes(app, { storage });
  const scout = Router();
  scout.get("/counties", (_req, res) => res.json({ owner: "scout-counties" }));
  scout.get("/county/:fips", (req, res) => res.json({ owner: "scout-county", fips: req.params.fips }));
  scout.use((_req, res) => res.status(418).json({ owner: "scout-sentinel" }));
  app.use("/api/heatmap", scout);
  return app;
}

describe("public heatmap extraction contract", () => {
  it("registers the exact public GET with one handler", () => {
    const registrations: Array<[string, string, number]> = [];
    registerPublicHeatmapRoutes(
      { get: (route: string, ...handlers: unknown[]) => registrations.push(["GET", route, handlers.length]) } as any,
      { storage: createStorage() }
    );
    expect(registrations).toEqual([["GET", "/api/heatmap", 1]]);
  });

  it("keeps the original root order, namespace precedence, and narrow dependency", () => {
    const root = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    const module = fs.readFileSync(path.resolve("server/routes/public-heatmap.ts"), "utf8");
    const admin = fs.readFileSync(path.resolve("server/routes/admin.ts"), "utf8");
    expect(root.match(/registerPublicHeatmapRoutes\(app, \{ storage \}\);/g)).toHaveLength(1);
    expect(root).not.toContain('app.get("/api/heatmap"');
    const setup = root.indexOf('app.post("/api/auth/setup-profile"');
    const registration = root.indexOf("registerPublicHeatmapRoutes(app, { storage });");
    const mapCache = root.indexOf("const mapApiCacheTtlMs");
    const scoutMount = root.indexOf('app.use("/api/heatmap", scoutHeatmapRoutes)');
    expect(registration).toBeGreaterThan(setup);
    expect(mapCache).toBeGreaterThan(registration);
    expect(scoutMount).toBeGreaterThan(registration);
    expect(module).toContain('Pick<IStorage, "getLocalityHeatmapData">');
    expect(module).not.toMatch(/from ["']\.\.\/storage["']/);
    expect(root).toContain("mountAdminRoutes(app);");
    expect(admin).toContain('"/api/admin/heatmap"');
    expect(admin).toContain("storage.getLocalityHeatmapData(days)");
  });

  it("serves only the base route before the Scout heatmap namespace", async () => {
    const storage = createStorage([{ fips: "12033" }]);
    const app = createNamespacedApp(storage);
    expect((await request(app).get("/api/heatmap")).body).toEqual([{ fips: "12033" }]);
    expect((await request(app).get("/api/heatmap/")).body).toEqual([{ fips: "12033" }]);
    expect((await request(app).get("/api/heatmap/counties")).body).toEqual({ owner: "scout-counties" });
    expect((await request(app).get("/api/heatmap/county/12033")).body).toEqual({
      owner: "scout-county",
      fips: "12033",
    });
    expect(storage.getLocalityHeatmapData).toHaveBeenCalledTimes(2);
  });
});

describe("public heatmap behavior", () => {
  it.each([
    { timeframe: undefined, days: 30 },
    { timeframe: "", days: 30 },
    { timeframe: "7d", days: 7 },
    { timeframe: "30d", days: 30 },
    { timeframe: "90d", days: 90 },
    { timeframe: "garbage", days: 90 },
  ])("maps timeframe $timeframe to $days days", async ({ timeframe, days }) => {
    const storage = createStorage();
    const url = timeframe === undefined ? "/api/heatmap" : `/api/heatmap?timeframe=${timeframe}`;
    expect((await request(createNamespacedApp(storage)).get(url)).status).toBe(200);
    expect(storage.getLocalityHeatmapData).toHaveBeenCalledWith(days);
  });

  it("preserves repeated-query coercion and exact storage output", async () => {
    const rows = [{ county: "Escambia", score: 12 }];
    const storage = createStorage(rows);
    const response = await request(createNamespacedApp(storage)).get(
      "/api/heatmap?timeframe=7d&timeframe=30d"
    );
    expect(response.body).toEqual(rows);
    expect(storage.getLocalityHeatmapData).toHaveBeenCalledWith(90);
  });

  it("preserves the exact 500 response", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const storage = { getLocalityHeatmapData: vi.fn().mockRejectedValue(new Error("db")) };
    const response = await request(createNamespacedApp(storage)).get("/api/heatmap");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Failed to fetch heatmap data" });
    expect(error).toHaveBeenCalledWith("Error fetching heatmap data:", expect.any(Error));
    error.mockRestore();
  });
});
