import { describe, expect, it } from "vitest";
import { hydratePricingAnalyticsWithStarterData } from "../pricingAnalyticsStarter";
import type { PricingAnalytics } from "../pricing-analytics";

const emptyAnalytics = (): PricingAnalytics => ({
  averageQuotes: {
    byTrade: {},
    byRegion: {},
    byProject: {},
  },
  priceFluctuations: {
    trades: [],
    regions: [],
  },
  popularProjects: [],
  marketInsights: {
    topPerformingRegions: [],
    emergingTrends: [],
  },
});

describe("pricing analytics starter hydration", () => {
  it("fills starter data for fully empty payloads", () => {
    const hydrated = hydratePricingAnalyticsWithStarterData(emptyAnalytics(), "30d");
    expect(hydrated.dataMode).toBe("starter");
    expect(hydrated.starterDataUsed).toBe(true);
    expect(Object.keys(hydrated.averageQuotes.byTrade).length).toBeGreaterThan(0);
    expect(Object.keys(hydrated.averageQuotes.byRegion).length).toBeGreaterThan(0);
    expect(hydrated.popularProjects.length).toBeGreaterThan(0);
    expect(hydrated.marketInsights.emergingTrends.length).toBeGreaterThan(0);
  });

  it("keeps live data intact and backfills only missing segments", () => {
    const base = emptyAnalytics();
    base.averageQuotes.byTrade = {
      Plumbing: { average: 400, count: 10, trend: 2.1 },
    };
    base.priceFluctuations.trades = [
      {
        tradeId: "plumbing",
        tradeName: "Plumbing",
        currentAvg: 400,
        previousAvg: 392,
        percentChange: 2.1,
        period: "30d",
      },
    ];

    const hydrated = hydratePricingAnalyticsWithStarterData(base, "30d");
    expect(hydrated.dataMode).toBe("blended");
    expect(hydrated.averageQuotes.byTrade.Plumbing?.average).toBe(400);
    expect(hydrated.averageQuotes.byRegion).not.toEqual({});
  });
});
