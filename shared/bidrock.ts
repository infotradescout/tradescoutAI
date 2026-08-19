export const BIDROCK_PUBLIC_ROUTE = "/bidrock";
export const BIDROCK_DEFAULT_PROFILE_SLUG = "jw-stone";
export const BIDROCK_SOLD_LISTING_FEE_CENTS = 10_000;
export const BIDROCK_PAYMENT_METHOD = "ach" as const;
export const BIDROCK_PRICE_VISIBILITY = "verified_business" as const;

export const BIDROCK_PRICE_UNITS = ["sqft", "slab"] as const;
export type BidRockPriceUnit = (typeof BIDROCK_PRICE_UNITS)[number];

export const BIDROCK_STONE_MATERIAL_FAMILIES = [
  "granite",
  "marble",
  "quartzite",
  "quartz",
  "engineered-quartz",
  "engineered-stone",
  "onyx",
  "soapstone",
  "basalt",
  "travertine",
  "limestone",
  "dolomite",
  "porcelain",
  "porcelain-slab",
  "sintered-stone",
  "slate",
  "natural-stone",
  "stone",
] as const;

export type BidRockPrice = Readonly<{
  unit: BidRockPriceUnit;
  amountCents: number;
  currency: "USD";
}>;

function normalizeSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function isBidRockPriceUnit(value: unknown): value is BidRockPriceUnit {
  return BIDROCK_PRICE_UNITS.includes(String(value || "") as BidRockPriceUnit);
}

export function isBidRockStoneMaterialFamily(
  value: unknown,
  sourceProfileSlug?: string | null
): boolean {
  const family = normalizeSlug(value);
  const profileSlug = normalizeSlug(sourceProfileSlug);
  if (
    BIDROCK_STONE_MATERIAL_FAMILIES.includes(
      family as (typeof BIDROCK_STONE_MATERIAL_FAMILIES)[number]
    )
  ) {
    return true;
  }
  return profileSlug === "jw-stone" && family === "unconfirmed";
}

export function normalizeBidRockAmountToCents(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(String(value || "").trim());
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
  return Math.round(amount * 100);
}

export function formatBidRockPrice(price: BidRockPrice): string {
  const amount = (price.amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return price.unit === "sqft" ? `${amount} / sq ft` : `${amount} / slab`;
}

export function buildBidRockSourceProfileAccountPath(profileSlug?: string | null): string {
  const normalized = normalizeSlug(profileSlug) || BIDROCK_DEFAULT_PROFILE_SLUG;
  const params = new URLSearchParams({ profileAccount: "1" });
  return `/u/${encodeURIComponent(normalized)}?${params.toString()}`;
}
