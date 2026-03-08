import type { PricingAnalytics } from "./pricing-analytics";

export type PricingAnalyticsDataMode = "live" | "blended" | "starter";

export type HydratedPricingAnalytics = PricingAnalytics & {
  dataMode: PricingAnalyticsDataMode;
  starterDataUsed: boolean;
};

function starterByTrade() {
  return {
    Plumbing: { average: 420, count: 18, trend: 4.2 },
    Electrical: { average: 510, count: 14, trend: 2.6 },
    Roofing: { average: 980, count: 11, trend: 6.8 },
    HVAC: { average: 760, count: 13, trend: -1.7 },
    "General Repair": { average: 340, count: 16, trend: 1.4 },
  };
}

function starterByRegion() {
  return {
    "Tangipahoa Parish, LA": { average: 610, count: 22, trend: 3.1 },
    "St. Tammany Parish, LA": { average: 690, count: 17, trend: 4.8 },
    "Livingston Parish, LA": { average: 560, count: 14, trend: 1.9 },
    "East Baton Rouge Parish, LA": { average: 720, count: 19, trend: -0.8 },
  };
}

function starterByProject() {
  return {
    "emergency-repair": { average: 540, count: 21, trend: 5.3 },
    "bathroom-upgrade": { average: 4100, count: 8, trend: 2.2 },
    "roof-replacement": { average: 11200, count: 6, trend: 7.4 },
    "electrical-upgrade": { average: 3200, count: 7, trend: 1.1 },
  };
}

function starterPriceFluctuations(timeframe: "7d" | "30d" | "90d") {
  return {
    trades: [
      {
        tradeId: "starter-roofing",
        tradeName: "Roofing",
        currentAvg: 980,
        previousAvg: 918,
        percentChange: 6.8,
        period: timeframe,
      },
      {
        tradeId: "starter-plumbing",
        tradeName: "Plumbing",
        currentAvg: 420,
        previousAvg: 403,
        percentChange: 4.2,
        period: timeframe,
      },
      {
        tradeId: "starter-hvac",
        tradeName: "HVAC",
        currentAvg: 760,
        previousAvg: 773,
        percentChange: -1.7,
        period: timeframe,
      },
    ],
    regions: [
      {
        countyId: "starter-22105",
        countyName: "Tangipahoa Parish",
        stateCode: "LA",
        currentAvg: 610,
        previousAvg: 592,
        percentChange: 3.1,
        period: timeframe,
      },
      {
        countyId: "starter-22103",
        countyName: "St. Tammany Parish",
        stateCode: "LA",
        currentAvg: 690,
        previousAvg: 658,
        percentChange: 4.8,
        period: timeframe,
      },
      {
        countyId: "starter-22051",
        countyName: "Jefferson Parish",
        stateCode: "LA",
        currentAvg: 670,
        previousAvg: 684,
        percentChange: -2.0,
        period: timeframe,
      },
    ],
  };
}

function starterPopularProjects() {
  return [
    { projectType: "emergency-repair", quoteCount: 21, averageValue: 540, growth: 5.3 },
    { projectType: "bathroom-upgrade", quoteCount: 8, averageValue: 4100, growth: 2.2 },
    { projectType: "roof-replacement", quoteCount: 6, averageValue: 11200, growth: 7.4 },
    { projectType: "electrical-upgrade", quoteCount: 7, averageValue: 3200, growth: 1.1 },
  ];
}

function starterMarketInsights() {
  return {
    topPerformingRegions: [
      { county: "St. Tammany Parish", state: "LA", averageQuote: 690, volume: 17 },
      { county: "East Baton Rouge Parish", state: "LA", averageQuote: 720, volume: 19 },
      { county: "Tangipahoa Parish", state: "LA", averageQuote: 610, volume: 22 },
    ],
    emergingTrends: [
      {
        trend: "Roofing",
        growth: 6.8,
        description: "Roofing request value is up 6.8% versus the prior window.",
      },
      {
        trend: "Emergency repair",
        growth: 5.3,
        description: "Emergency repair volume continues to trend upward week-over-week.",
      },
      {
        trend: "Plumbing",
        growth: 4.2,
        description: "Plumbing requests show steady growth across active counties.",
      },
    ],
  };
}

export function hydratePricingAnalyticsWithStarterData(
  analytics: PricingAnalytics,
  timeframe: "7d" | "30d" | "90d"
): HydratedPricingAnalytics {
  const hasTradeData = Object.keys(analytics.averageQuotes.byTrade || {}).length > 0;
  const hasRegionData = Object.keys(analytics.averageQuotes.byRegion || {}).length > 0;
  const hasProjectData = Object.keys(analytics.averageQuotes.byProject || {}).length > 0;
  const hasTradeFluctuations = (analytics.priceFluctuations.trades || []).length > 0;
  const hasRegionFluctuations = (analytics.priceFluctuations.regions || []).length > 0;
  const hasPopularProjects = (analytics.popularProjects || []).length > 0;
  const hasTopRegions = (analytics.marketInsights.topPerformingRegions || []).length > 0;
  const hasEmergingTrends = (analytics.marketInsights.emergingTrends || []).length > 0;

  if (
    hasTradeData &&
    hasRegionData &&
    hasProjectData &&
    hasTradeFluctuations &&
    hasRegionFluctuations &&
    hasPopularProjects &&
    hasTopRegions &&
    hasEmergingTrends
  ) {
    return { ...analytics, dataMode: "live", starterDataUsed: false };
  }

  const starterFluctuations = starterPriceFluctuations(timeframe);
  const hydrated: PricingAnalytics = {
    averageQuotes: {
      byTrade: hasTradeData ? analytics.averageQuotes.byTrade : starterByTrade(),
      byRegion: hasRegionData ? analytics.averageQuotes.byRegion : starterByRegion(),
      byProject: hasProjectData ? analytics.averageQuotes.byProject : starterByProject(),
    },
    priceFluctuations: {
      trades: hasTradeFluctuations
        ? analytics.priceFluctuations.trades
        : starterFluctuations.trades,
      regions: hasRegionFluctuations
        ? analytics.priceFluctuations.regions
        : starterFluctuations.regions,
    },
    popularProjects: hasPopularProjects ? analytics.popularProjects : starterPopularProjects(),
    marketInsights: {
      topPerformingRegions: hasTopRegions
        ? analytics.marketInsights.topPerformingRegions
        : starterMarketInsights().topPerformingRegions,
      emergingTrends: hasEmergingTrends
        ? analytics.marketInsights.emergingTrends
        : starterMarketInsights().emergingTrends,
    },
  };

  const mode: PricingAnalyticsDataMode =
    hasTradeData ||
    hasRegionData ||
    hasProjectData ||
    hasTradeFluctuations ||
    hasRegionFluctuations ||
    hasPopularProjects ||
    hasTopRegions ||
    hasEmergingTrends
      ? "blended"
      : "starter";

  return {
    ...hydrated,
    dataMode: mode,
    starterDataUsed: true,
  };
}
