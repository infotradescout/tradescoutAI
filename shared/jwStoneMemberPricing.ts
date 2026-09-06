export const JW_STONE_PRICING_PROFILE_SLUG = "jw-stone" as const;
export const JW_STONE_MEMBER_PRICING_PRODUCT_KEY = "jw_stone_member_pricing" as const;

// Stable Google Drive identifiers are configuration, not price data. The server
// verifies both before reading the workbook and never sends either to browsers.
export const JW_STONE_PRICING_DRIVE_FOLDER_ID = "1Q8z9mjKWilONhSYgeD1Q3CqQkROJAfWW" as const;
export const JW_STONE_PRICING_DRIVE_FILE_ID = "1qqi8lgedSFecuIozNe3TapkqzHuiz4YJ" as const;
export const JW_STONE_PRICING_WORKSHEET = "Fabricator Pricing" as const;

export type JwStonePricingAccess = "member" | "internal";

export type JwStoneMemberPrice = Readonly<{
  stoneName: string;
  stoneKey: string;
  slabPriceCents: number;
  bundlePriceCents: number;
  /** Explicit slab-count threshold from the private workbook; absent for legacy bundles. */
  bundleMinSlabs?: number;
}>;

export type JwStoneInternalPrice = Readonly<
  JwStoneMemberPrice & {
    landedCostCents: number | null;
  }
>;

type JwStonePricingResponseBase = Readonly<{
  profileSlug: typeof JW_STONE_PRICING_PROFILE_SLUG;
  viewerId: string;
  currency: "USD";
  unit: "square_foot";
  sourceUpdatedAt: string;
}>;

export type JwStoneMemberPricingResponse = Readonly<
  JwStonePricingResponseBase & {
    access: "member";
    prices: readonly JwStoneMemberPrice[];
  }
>;

export type JwStoneInternalPricingResponse = Readonly<
  JwStonePricingResponseBase & {
    access: "internal";
    prices: readonly JwStoneInternalPrice[];
  }
>;

export type JwStonePricingResponse = JwStoneMemberPricingResponse | JwStoneInternalPricingResponse;

/**
 * Canonical join key for Drive rows, catalog stones, and confirmed inventory.
 * It intentionally normalizes presentation punctuation without inventing aliases.
 */
export function jwStonePriceKey(value: unknown): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
