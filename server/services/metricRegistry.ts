/**
 * Metric Registry - Canonical authority for valid county metrics
 *
 * This is the single source of truth for metric keys.
 * Only registered metrics can be written to the county_metrics table.
 *
 * No UI, no computation - this is purely a registry of facts.
 */

// ============================================================================
// METRIC REGISTRY - Locked Initial Keys
// ============================================================================

export enum MetricKey {
  // User aggregates (verified counts only)
  USERS_TOTAL = "users_total",
  USERS_VERIFIED = "users_verified",

  // Role/type counts (derived from user table claims/roles, not computed)
  CONTRACTORS_TOTAL = "contractors_total",
  HOMEOWNERS_TOTAL = "homeowners_total",

  // Affiliate aggregates (Phase 2b)
  AFFILIATES_COUNT = "affiliates_count",

  // TradeDeals aggregates (Phase 2b)
  TRADEDEALS_ACTIVE = "tradedeals_active",
  TRADEDEALS_CLAIMED_30D = "tradedeals_claimed_30d",

  // HomeScout aggregates
  HOMESCOUT_ACTIVE_LISTINGS = "homescout_active_listings",
  HOMESCOUT_MEDIAN_PRICE = "homescout_median_price",
  HOMESCOUT_MEDIAN_DOM_DAYS = "homescout_median_dom_days",
  HOMESCOUT_PRICE_DROPS_7D = "homescout_price_drops_7d",
}

/**
 * Metric metadata: type, description, allowed range
 */
interface MetricDefinition {
  key: MetricKey;
  description: string;
  dataType: "integer" | "decimal";
  minValue: number;
  maxValue: number;
  acceptsNegative: boolean;
}

/**
 * Canonical metric definitions
 */
const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  [MetricKey.USERS_TOTAL]: {
    key: MetricKey.USERS_TOTAL,
    description: "Total count of users in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 999_999_999,
    acceptsNegative: false,
  },
  [MetricKey.USERS_VERIFIED]: {
    key: MetricKey.USERS_VERIFIED,
    description: "Count of identity-verified users in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 999_999_999,
    acceptsNegative: false,
  },
  [MetricKey.CONTRACTORS_TOTAL]: {
    key: MetricKey.CONTRACTORS_TOTAL,
    description: "Total count of contractors in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 999_999_999,
    acceptsNegative: false,
  },
  [MetricKey.HOMEOWNERS_TOTAL]: {
    key: MetricKey.HOMEOWNERS_TOTAL,
    description: "Total count of homeowners in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 999_999_999,
    acceptsNegative: false,
  },
  [MetricKey.AFFILIATES_COUNT]: {
    key: MetricKey.AFFILIATES_COUNT,
    description: "Total count of affiliate accounts in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 999_999_999,
    acceptsNegative: false,
  },
  [MetricKey.TRADEDEALS_ACTIVE]: {
    key: MetricKey.TRADEDEALS_ACTIVE,
    description: "Count of active TradeDeals in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 999_999_999,
    acceptsNegative: false,
  },
  [MetricKey.TRADEDEALS_CLAIMED_30D]: {
    key: MetricKey.TRADEDEALS_CLAIMED_30D,
    description: "Count of TradeDeals claimed in last 30 days in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 999_999_999,
    acceptsNegative: false,
  },
  [MetricKey.HOMESCOUT_ACTIVE_LISTINGS]: {
    key: MetricKey.HOMESCOUT_ACTIVE_LISTINGS,
    description: "Count of active HomeScout listings in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 999_999_999,
    acceptsNegative: false,
  },
  [MetricKey.HOMESCOUT_MEDIAN_PRICE]: {
    key: MetricKey.HOMESCOUT_MEDIAN_PRICE,
    description:
      "Median list price (USD, rounded to whole dollars) for active HomeScout listings in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 9_999_999_999,
    acceptsNegative: false,
  },
  [MetricKey.HOMESCOUT_MEDIAN_DOM_DAYS]: {
    key: MetricKey.HOMESCOUT_MEDIAN_DOM_DAYS,
    description:
      "Median days on market (days since listed_at) for active HomeScout listings in county",
    dataType: "integer",
    minValue: 0,
    maxValue: 9_999_999,
    acceptsNegative: false,
  },
  [MetricKey.HOMESCOUT_PRICE_DROPS_7D]: {
    key: MetricKey.HOMESCOUT_PRICE_DROPS_7D,
    description:
      "Count of active HomeScout listings in county with a price drop event in the last 7 days",
    dataType: "integer",
    minValue: 0,
    maxValue: 999_999_999,
    acceptsNegative: false,
  },
};

// ============================================================================
// REGISTRY API
// ============================================================================

/**
 * Check if a metric key is registered
 */
export function isMetricKeyRegistered(key: string): key is MetricKey {
  return Object.values(MetricKey).includes(key as MetricKey);
}

/**
 * Get metric definition by key
 */
export function getMetricDefinition(key: MetricKey): MetricDefinition {
  const def = METRIC_DEFINITIONS[key];
  if (!def) {
    throw new Error(`Metric key "${key}" is not registered`);
  }
  return def;
}

/**
 * Get all registered metric keys
 */
export function getAllRegisteredMetricKeys(): MetricKey[] {
  return Object.values(MetricKey);
}

/**
 * Get all metric definitions
 */
export function getAllMetricDefinitions(): MetricDefinition[] {
  return getAllRegisteredMetricKeys().map((key) => METRIC_DEFINITIONS[key]);
}

/**
 * Validate a metric value against its definition
 * Throws if invalid
 */
export function validateMetricValue(key: MetricKey, value: number): void {
  const def = getMetricDefinition(key);

  // Type check
  if (def.dataType === "integer" && !Number.isInteger(value)) {
    throw new Error(`Metric "${key}" expects integer value, got ${value}`);
  }

  // Range check
  if (value < def.minValue) {
    throw new Error(`Metric "${key}" value ${value} below minimum ${def.minValue}`);
  }
  if (value > def.maxValue) {
    throw new Error(`Metric "${key}" value ${value} exceeds maximum ${def.maxValue}`);
  }

  // Negative check
  if (!def.acceptsNegative && value < 0) {
    throw new Error(`Metric "${key}" does not accept negative values, got ${value}`);
  }
}

/**
 * Validate a FIPS code (5-digit string)
 * Throws if invalid
 */
export function validateFipsCode(fips: string): void {
  if (typeof fips !== "string" || fips.length !== 5 || !/^\d+$/.test(fips)) {
    throw new Error(`Invalid FIPS code: "${fips}" (must be 5-digit string)`);
  }
}
