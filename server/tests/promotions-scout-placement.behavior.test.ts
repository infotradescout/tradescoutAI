import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  createPromotion: vi.fn(),
  getPromotion: vi.fn(),
  updatePromotion: vi.fn(),
}));
vi.mock("../storage", () => ({ storage: mocks }));

import { createPromotionHandler, updatePromotionHandler } from "../routes/promotions";

const existing = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "trade_deal",
  tier: "paid_campaign",
  status: "active",
  exclusive: true,
  placementScout: true,
  placementCommunitySnapshot: false,
  countyFips: ["04013"],
};

function response() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & typeof res;
}

describe("promotion Scout placement publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPromotion.mockResolvedValue(existing);
    mocks.updatePromotion.mockImplementation(async (_id, body) => ({ ...existing, ...body }));
  });

  it("requires an exclusive offer before publishing a TradeDeal in Scout", async () => {
    const res = response();
    await createPromotionHandler(
      {
        body: {
          title: "County offer",
          shortDescription: "Posted terms",
          type: "trade_deal",
          tier: "paid_campaign",
          status: "active",
          exclusive: false,
          audienceScope: "county",
          countyFips: ["04013"],
          placementScout: true,
        },
      } as Request,
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "exclusive=true is required for placed TradeDeals",
    });
    expect(mocks.createPromotion).not.toHaveBeenCalled();
  });

  it("keeps paid placements on a status-only update", async () => {
    const res = response();
    await updatePromotionHandler(
      { params: { id: existing.id }, body: { status: "paused" } } as unknown as Request,
      res
    );
    expect(mocks.updatePromotion).toHaveBeenCalledWith(existing.id, { status: "paused" });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a Scout placement if the offer is no longer exclusive", async () => {
    const res = response();
    await updatePromotionHandler(
      { params: { id: existing.id }, body: { exclusive: false } } as unknown as Request,
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.updatePromotion).not.toHaveBeenCalled();
  });
});
