export type MarketSignalWindow = "1h" | "24h" | "7d" | "30d";

export type MarketSignalStatus = "ok" | "suppressed";

export type MarketSignalSurface =
  | "scout"
  | "exchange"
  | "homescout_listings"
  | "trade_deals"
  | "direct_connect";

export interface ThresholdSuppressedResponse {
  status: "suppressed";
  reason: "minimum_threshold_not_met";
}

export interface CountyDemandSnapshot {
  status: "ok";
  countyFips: string;
  stateCode?: string;
  window: MarketSignalWindow;
  generatedAt: string;
  signals: {
    demandIndex: number;
    trustWeightedDemandIndex: number;
    inventoryPressureIndex: number;
    conversionReadinessIndex: number;
  };
  topCategories: Array<{
    category: string;
    direction: "up" | "down" | "flat";
    changePct: number;
  }>;
}

export interface CategoryTrendSnapshot {
  status: "ok";
  category: string;
  countyFips?: string;
  stateCode?: string;
  window: MarketSignalWindow;
  generatedAt: string;
  demandVelocityIndex: number;
  trustWeightedActivityIndex: number;
  priceBand?: {
    low: number;
    median: number;
    high: number;
  };
  volumeBand: "low" | "medium" | "high";
}

export interface BrandTrendSnapshot {
  status: "ok";
  brand: string;
  category?: string;
  countyFips?: string;
  stateCode?: string;
  window: MarketSignalWindow;
  generatedAt: string;
  brandTrendIndex: number;
  usageVelocityIndex: number;
  spendBand?: {
    low: number;
    median: number;
    high: number;
  };
}

export interface HomeScoutListingsInventorySnapshot {
  status: "ok";
  countyFips: string;
  stateCode: string;
  propertyType?: string;
  window: MarketSignalWindow;
  generatedAt: string;
  activeListingCount: number;
  newListingVelocityIndex: number;
  priceDropPressureIndex: number;
  buyerDemandProxyIndex: number;
}

export interface ActivationReadinessSnapshot {
  status: "ok";
  countyFips?: string;
  stateCode?: string;
  category?: string;
  surface?: MarketSignalSurface;
  window: MarketSignalWindow;
  generatedAt: string;
  marketActivationScore: number;
  sponsorReadinessScore: number;
  meetsMinimumAudienceThreshold: boolean;
  recommendedSurface?: MarketSignalSurface;
}

export interface CountyCrawlerObservationSnapshot {
  status: "ok";
  partnerSlug?: string;
  window: MarketSignalWindow;
  generatedAt: string;
  counties: Array<{
    countyFips: string;
    countyName: string;
    stateCode: string;
    requestCount: number;
    okRatePct: number;
    trend: "up" | "down" | "flat";
    changePct: number;
    dominantSurface: string;
    surfaceMix: Array<{
      surface: string;
      requestCount: number;
      sharePct: number;
    }>;
  }>;
}

export type MarketSignalResponse =
  | ThresholdSuppressedResponse
  | CountyDemandSnapshot
  | CategoryTrendSnapshot
  | BrandTrendSnapshot
  | HomeScoutListingsInventorySnapshot
  | ActivationReadinessSnapshot
  | CountyCrawlerObservationSnapshot;
