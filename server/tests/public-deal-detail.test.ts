import express from "express";
import type { Request, Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPromotion: vi.fn() }));
vi.mock("../storage", () => ({ storage: { getPromotion: mocks.getPromotion } }));

import { getPublicScoutDealDetail } from "../routes/public-deal-detail";

const DEAL_ID = "11111111-2222-4333-8444-555555555555";
const eligiblePromotion = () => ({
  id: DEAL_ID,
  title: "County tool rental offer",
  shortDescription: "Posted offer terms for this county.",
  type: "trade_deal",
  tier: "paid_campaign",
  exclusive: true,
  status: "active",
  placementScout: true,
  startsAt: new Date("2020-01-01T00:00:00.000Z"),
  endsAt: new Date("2099-01-01T00:00:00.000Z"),
  countyFips: ["04013"],
  createdAt: new Date("2026-09-23T00:00:00.000Z"),
  ctaUrl: "https://outside.example/claim",
  ownerUserId: "private-user",
});

const app = express();
app.get("/api/deals/:id", getPublicScoutDealDetail);

describe("public Scout TradeDeal detail", () => {
  beforeEach(() => mocks.getPromotion.mockReset());

  it("returns only public posted terms for the exact eligible county deal", async () => {
    mocks.getPromotion.mockResolvedValue(eligiblePromotion());
    const response = await request(app).get(`/api/deals/${DEAL_ID}?county=04013`);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(mocks.getPromotion).toHaveBeenCalledWith(DEAL_ID);
    expect(response.body.deal).toEqual({
      id: DEAL_ID,
      title: "County tool rental offer",
      description: "Posted offer terms for this county.",
      scope: "county",
      source: "TradeScout posted promotion",
    });
    expect(JSON.stringify(response.body)).not.toContain("outside.example");
    expect(JSON.stringify(response.body)).not.toContain("private-user");
  });

  it("allows a global posted deal without a county", async () => {
    mocks.getPromotion.mockResolvedValue({ ...eligiblePromotion(), countyFips: [] });
    const response = await request(app).get(`/api/deals/${DEAL_ID}`);
    expect(response.status).toBe(200);
    expect(response.body.deal.scope).toBe("global");
  });

  it("hides wrong-county, missing-county, unpublished, and expired deals", async () => {
    for (const [query, change] of [
      ["?county=06037", {}],
      ["", {}],
      ["?county=04013", { status: "draft" }],
      ["?county=04013", { placementScout: false }],
      ["?county=04013", { tier: "free_directory" }],
      ["?county=04013", { exclusive: false }],
      ["?county=04013", { startsAt: new Date("2099-01-01T00:00:00.000Z") }],
      ["?county=04013", { endsAt: new Date("2020-01-01T00:00:00.000Z") }],
    ] as const) {
      mocks.getPromotion.mockResolvedValue({ ...eligiblePromotion(), ...change });
      const response = await request(app).get(`/api/deals/${DEAL_ID}${query}`);
      expect(response.status, JSON.stringify({ query, change })).toBe(404);
      expect(response.body).toEqual({ message: "TradeDeal unavailable" });
    }
  });

  it("rejects malformed identity or county before database access", async () => {
    for (const path of [
      "/api/deals/not-an-id?county=04013",
      `/api/deals/${DEAL_ID}?county=unknown`,
      `/api/deals/${DEAL_ID}?county=04013&county=06037`,
    ]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(404);
    }
    expect(mocks.getPromotion).not.toHaveBeenCalled();
  });

  it("returns a temporary service failure when the promotion store is unavailable", async () => {
    mocks.getPromotion.mockRejectedValueOnce(new Error("Synthetic store failure"));
    const response = {
      set: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await getPublicScoutDealDetail(
        { params: { id: DEAL_ID }, query: { county: "04013" } } as unknown as Request,
        response as unknown as Response
      );
      expect(response.status).toHaveBeenCalledWith(503);
      expect(response.json).toHaveBeenCalledWith({ message: "TradeDeal temporarily unavailable" });
    } finally {
      log.mockRestore();
    }
  });
});
