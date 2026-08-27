import express from "express";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  registerQuoteCalculatorRoutes,
  type QuoteCalculatorStorage,
} from "../routes/quote-calculator";

function createStorage(data: any[] | null = []): QuoteCalculatorStorage {
  return { getPricingData: vi.fn().mockResolvedValue(data) };
}

function createApp(storage: QuoteCalculatorStorage) {
  const app = express();
  app.use(express.json());
  registerQuoteCalculatorRoutes(app, { storage });
  return app;
}

describe("quote calculator extraction contract", () => {
  it("registers only the exact public method/path pairs with no middleware", () => {
    const registrations: Array<[string, string, number]> = [];
    const app = {
      get: (route: string, ...handlers: unknown[]) => registrations.push(["GET", route, handlers.length]),
      post: (route: string, ...handlers: unknown[]) =>
        registrations.push(["POST", route, handlers.length]),
    };
    registerQuoteCalculatorRoutes(app as any, { storage: createStorage() });
    expect(registrations).toEqual([
      ["GET", "/api/pricing/:service", 1],
      ["POST", "/api/calculator", 1],
    ]);
  });

  it("keeps one root registration in the original order and an acyclic storage boundary", () => {
    const root = fs.readFileSync(path.resolve("server/routes.ts"), "utf8");
    const module = fs.readFileSync(path.resolve("server/routes/quote-calculator.ts"), "utf8");
    expect(root.match(/registerQuoteCalculatorRoutes\(app, \{ storage \}\);/g)).toHaveLength(1);
    expect(root).not.toContain('app.get("/api/pricing/:service"');
    expect(root).not.toContain('app.post("/api/calculator"');
    expect(root.indexOf("registerQuoteCalculatorRoutes(app, { storage });")).toBeGreaterThan(
      root.indexOf('app.post("/api/admin/user-controls/role/:userId"')
    );
    expect(root.indexOf('app.post("/api/leads"')).toBeGreaterThan(
      root.indexOf("registerQuoteCalculatorRoutes(app, { storage });")
    );
    expect(module).toContain('Pick<IStorage, "getPricingData">');
    expect(module).not.toMatch(/from ["']\.\.\/storage["']/);
    expect(module).not.toMatch(/from ["']\.\.\/routes["']/);
  });
});

describe("quote calculator behavior", () => {
  it("passes service and optional FIPS through and returns pricing verbatim", async () => {
    const rows = [{ baseLow: "1000", baseHigh: "2000" }];
    const storage = createStorage(rows);
    const response = await request(createApp(storage)).get("/api/pricing/roofing?fips=12033");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(rows);
    expect(storage.getPricingData).toHaveBeenCalledWith("roofing", "12033");
  });

  it.each([
    ["roofing", "100", "planning", 1200, 1800],
    ["roof-repair", "100", "soon", 704, 1056],
    ["unknown", "100", "urgent", 1920, 2880],
  ])("preserves fallback rates and urgency for %s", async (projectType, squareFootage, urgency, low, high) => {
    const response = await request(createApp(createStorage())).post("/api/calculator").send({
      projectType,
      squareFootage,
      urgency,
      countyFips: "12033",
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ low, high, projectType, urgency });
  });

  it("preserves missing-body and invalid-square-footage defaults", async () => {
    const storage = createStorage(null);
    const response = await request(createApp(storage)).post("/api/calculator").send();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ low: 16000, high: 24000, urgency: "planning" });
    expect(storage.getPricingData).toHaveBeenCalledWith(undefined, undefined);
  });

  it("uses only the first database row and preserves rounding order", async () => {
    const storage = createStorage([
      { baseLow: "1555", baseHigh: "2666" },
      { baseLow: "999999", baseHigh: "999999" },
    ]);
    const response = await request(createApp(storage)).post("/api/calculator").send({
      projectType: "roofing",
      squareFootage: "333",
      countyFips: "12033",
      urgency: "soon",
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ low: 570, high: 977, urgency: "soon" });
    expect(storage.getPricingData).toHaveBeenCalledWith("roofing", "12033");
  });

  it("preserves null database rates as zero", async () => {
    const response = await request(createApp(createStorage([{ baseLow: null, baseHigh: null }])))
      .post("/api/calculator")
      .send({ projectType: "roofing", squareFootage: "500" });
    expect(response.body).toMatchObject({ low: 0, high: 0, urgency: "planning" });
  });

  it("preserves exact 500 responses", async () => {
    const storage = { getPricingData: vi.fn().mockRejectedValue(new Error("db")) };
    const app = createApp(storage);
    const pricing = await request(app).get("/api/pricing/roofing");
    const calculator = await request(app).post("/api/calculator").send({});
    expect(pricing.status).toBe(500);
    expect(pricing.body).toEqual({
      message: "Failed to fetch pricing data",
    });
    expect(calculator.status).toBe(500);
    expect(calculator.body).toEqual({
      message: "Failed to calculate estimate",
    });
  });
});
