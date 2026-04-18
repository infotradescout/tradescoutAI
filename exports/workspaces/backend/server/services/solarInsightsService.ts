type SolarConfidence = "low" | "medium" | "high";

export interface SolarProviderEstimateInput {
  lat: number;
  lng: number;
  monthlyBillUsd?: number;
  countyFips?: string;
  stateCode?: string;
}

export interface SolarProviderEstimate {
  countyFips: string | null;
  stateCode: string | null;
  confidence: SolarConfidence;
  systemSizeKw: number;
  annualProductionKwh: number;
  annualUsageKwh: number;
  estimatedInstallCostUsd: number;
  estimatedYearOneSavingsUsd: number;
  estimatedPaybackYears: number;
  assumptions: {
    electricRateUsdPerKwh: number;
    installCostUsdPerWatt: number;
    productionFactorKwhPerKwYear: number;
  };
  notes: string[];
}

export interface PublicSolarPriceInsight {
  countyFips: string | null;
  stateCode: string | null;
  confidence: SolarConfidence;
  estimatedCostRangeUsd: {
    low: number;
    high: number;
  };
  typicalSystemSizeKw: {
    low: number;
    high: number;
  };
  context: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseOptionalNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCountyFips(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  return value.slice(0, 12);
}

function normalizeStateCode(raw: unknown): string | null {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!value) return null;
  return value.slice(0, 8);
}

export function isSolarV1Enabled(): boolean {
  return (
    String(process.env.FEATURE_SOLAR_V1 || "false")
      .trim()
      .toLowerCase() === "true"
  );
}

function shouldPreferGoogleSolarProvider(): boolean {
  const enabled =
    String(process.env.FEATURE_SOLAR_GOOGLE_PROVIDER || "false")
      .trim()
      .toLowerCase() === "true";
  const hasApiKey = String(process.env.GOOGLE_SOLAR_API_KEY || "").trim().length > 0;
  return enabled && hasApiKey;
}

export function buildSolarProviderEstimate(
  input: SolarProviderEstimateInput
): SolarProviderEstimate {
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid coordinates for solar estimate");
  }

  const configuredCostPerWatt = parseOptionalNumber(process.env.SOLAR_DEFAULT_COST_PER_WATT_USD);
  const configuredElectricRate = parseOptionalNumber(process.env.SOLAR_DEFAULT_ELECTRIC_RATE_USD);

  const electricRateUsdPerKwh =
    configuredElectricRate !== null ? clamp(configuredElectricRate, 0.08, 0.6) : 0.16;
  const installCostUsdPerWatt =
    configuredCostPerWatt !== null ? clamp(configuredCostPerWatt, 1.25, 7.5) : 2.8;

  const monthlyBillUsd = parseOptionalNumber(input.monthlyBillUsd);
  const annualUsageKwh =
    monthlyBillUsd !== null && monthlyBillUsd > 0
      ? clamp((monthlyBillUsd / electricRateUsdPerKwh) * 12, 1200, 60000)
      : 12000;

  // Simple phase-1 latitude heuristic for yearly production per kW.
  const absLat = Math.abs(lat);
  const productionFactorKwhPerKwYear = roundTo(clamp(1750 - absLat * 9, 1100, 1750), 0);

  const systemSizeKw = roundTo(clamp(annualUsageKwh / productionFactorKwhPerKwYear, 2, 30), 1);
  const annualProductionKwh = roundTo(systemSizeKw * productionFactorKwhPerKwYear, 0);

  const estimatedInstallCostUsd = roundTo(systemSizeKw * 1000 * installCostUsdPerWatt, 0);
  const estimatedYearOneSavingsUsd = roundTo(
    clamp(annualProductionKwh * electricRateUsdPerKwh, 300, annualUsageKwh * electricRateUsdPerKwh),
    0
  );
  const estimatedPaybackYears = roundTo(
    estimatedInstallCostUsd / Math.max(estimatedYearOneSavingsUsd, 1),
    1
  );

  const providerModeEnabled = shouldPreferGoogleSolarProvider();
  const confidence: SolarConfidence = providerModeEnabled
    ? monthlyBillUsd
      ? "medium"
      : "low"
    : monthlyBillUsd
      ? "medium"
      : "low";

  const notes: string[] = [
    "Decision support only. Final quote requires roof geometry, shading, and utility tariff review.",
    "No direct homeowner contact is granted by this estimate path.",
  ];

  if (providerModeEnabled) {
    notes.push(
      "Google Solar provider mode is enabled, but this Phase 1 endpoint still returns explainable fallback math while external fetch integration is staged."
    );
  }

  return {
    countyFips: normalizeCountyFips(input.countyFips),
    stateCode: normalizeStateCode(input.stateCode),
    confidence,
    systemSizeKw,
    annualProductionKwh,
    annualUsageKwh: roundTo(annualUsageKwh, 0),
    estimatedInstallCostUsd,
    estimatedYearOneSavingsUsd,
    estimatedPaybackYears,
    assumptions: {
      electricRateUsdPerKwh,
      installCostUsdPerWatt,
      productionFactorKwhPerKwYear,
    },
    notes,
  };
}

export function buildPublicSolarPriceInsight(args: {
  countyFips?: string;
  stateCode?: string;
}): PublicSolarPriceInsight {
  const countyFips = normalizeCountyFips(args.countyFips);
  const stateCode = normalizeStateCode(args.stateCode);

  const configuredCostPerWatt = parseOptionalNumber(process.env.SOLAR_DEFAULT_COST_PER_WATT_USD);
  const installCostUsdPerWatt =
    configuredCostPerWatt !== null ? clamp(configuredCostPerWatt, 1.25, 7.5) : 2.8;

  const sizeLowKw = 6;
  const sizeHighKw = 11;

  const low = roundTo(sizeLowKw * 1000 * installCostUsdPerWatt, 0);
  const high = roundTo(sizeHighKw * 1000 * installCostUsdPerWatt, 0);

  const confidence: SolarConfidence = countyFips || stateCode ? "medium" : "low";

  return {
    countyFips,
    stateCode,
    confidence,
    estimatedCostRangeUsd: {
      low,
      high,
    },
    typicalSystemSizeKw: {
      low: sizeLowKw,
      high: sizeHighKw,
    },
    context: [
      "Local range only, not a binding quote.",
      "Scout should collect roof age, annual bill, and roof orientation before escalating to provider workflow.",
      "Contact remains gated through TradeScout decision pathways.",
    ],
  };
}
