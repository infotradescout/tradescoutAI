import { describe, expect, it } from "vitest";

import {
  bidDraftToDirectConnectEstimateLines,
  buildTradeScoutBidDraft,
  type BidBuilderInputLine,
} from "@shared/bidBuilder";

const confirmedLine: BidBuilderInputLine = {
  takeoff: {
    itemId: "millwork-crown-1",
    discipline: "millwork",
    category: "Crown moulding",
    description: "Install 5-inch crown moulding",
    quantity: 120,
    unit: "linear_ft",
    dimensions: "120 LF",
    planTag: "A6.2 / Room Finish Schedule",
    evidence: [
      {
        source: "plan_pdf",
        sourceId: "plan-set-1",
        sourceLabel: "A6.2 Room Finish Schedule",
        observedAt: "2026-07-19T16:00:00.000Z",
        confidence: 0.97,
        pageNumber: 12,
        sheetLabel: "A6.2",
      },
    ],
    confidence: 0.97,
    reviewStatus: "confirmed",
    warnings: [],
  },
  pricing: {
    materialUnitCostCents: 275,
    laborHours: 12,
    laborRateCents: 5500,
    wastePercent: 10,
    overheadPercent: 10,
    profitPercent: 20,
    taxPercent: 4.45,
    sourceNote: "Supplier quote dated 2026-07-19",
  },
};

describe("TradeScout Bid Builder foundation", () => {
  it("combines takeoff evidence with documented pricing and produces a ready bid", () => {
    const bid = buildTradeScoutBidDraft({
      bidId: "bid-1",
      projectId: "project-1",
      title: "Millwork package",
      scopeSummary: "Crown moulding shown on the finish schedule.",
      createdAt: "2026-07-19T16:05:00.000Z",
      lines: [confirmedLine],
    });

    expect(bid.status).toBe("ready");
    expect(bid.lines[0]?.materialCostCents).toBe(36_300);
    expect(bid.lines[0]?.laborCostCents).toBe(66_000);
    expect(bid.totalCents).toBeGreaterThan(bid.subtotalCents);
    expect(bid.warnings).toEqual([]);
  });

  it("holds low-confidence camera or plan output for review", () => {
    const bid = buildTradeScoutBidDraft({
      bidId: "bid-2",
      projectId: "project-2",
      title: "Field measure",
      scopeSummary: "Camera-assisted opening measurement.",
      createdAt: "2026-07-19T16:05:00.000Z",
      lines: [
        {
          takeoff: {
            ...confirmedLine.takeoff,
            itemId: "door-opening-1",
            discipline: "doors_windows",
            description: "Exterior door opening",
            quantity: 1,
            unit: "each",
            confidence: 0.72,
            reviewStatus: "needs_review",
            evidence: [
              {
                source: "field_camera",
                sourceId: "camera-capture-1",
                sourceLabel: "Field camera capture",
                observedAt: "2026-07-19T16:00:00.000Z",
                confidence: 0.72,
                imageUrl: "/uploads/camera-capture-1.jpg",
              },
            ],
          },
          pricing: {
            materialUnitCostCents: 80_000,
            sourceNote: "Draft supplier allowance",
          },
        },
      ],
    });

    expect(bid.status).toBe("review_required");
    expect(bid.warnings).toContain("Measurement or plan extraction needs human review.");
    expect(() => bidDraftToDirectConnectEstimateLines(bid)).toThrow(
      "Bid must be ready before it can become a Direct Connect estimate"
    );
  });

  it("does not invent pricing when only quantities are known", () => {
    const bid = buildTradeScoutBidDraft({
      bidId: "bid-3",
      projectId: "project-3",
      title: "Quantity-only takeoff",
      scopeSummary: "Quantities extracted before supplier and labor pricing.",
      createdAt: "2026-07-19T16:05:00.000Z",
      lines: [{ takeoff: confirmedLine.takeoff, pricing: {} }],
    });

    expect(bid.status).toBe("review_required");
    expect(bid.totalCents).toBe(0);
    expect(bid.warnings).toContain("No pricing basis has been entered for this item.");
    expect(bid.warnings).toContain("Pricing source is not documented.");
  });

  it("converts a reviewed bid into the existing Direct Connect estimate input", () => {
    const bid = buildTradeScoutBidDraft({
      bidId: "bid-4",
      projectId: "project-4",
      title: "Millwork bid",
      scopeSummary: "Reviewed quantity and pricing package.",
      createdAt: "2026-07-19T16:05:00.000Z",
      lines: [confirmedLine],
    });

    const estimateLines = bidDraftToDirectConnectEstimateLines(bid);
    expect(estimateLines.some((line) => line.lineType === "material")).toBe(true);
    expect(estimateLines.some((line) => line.lineType === "labor")).toBe(true);
    expect(estimateLines.some((line) => line.name.includes("overhead and profit"))).toBe(true);
  });
});
