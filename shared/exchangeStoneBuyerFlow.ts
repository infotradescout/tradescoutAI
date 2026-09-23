/** Pure presentation helpers. Contact authority remains in the existing Decision Card flow. */
export type StoneInquiryIntent = "availability" | "callback";
export type StonePriceUnit = "sqft" | "slab";
export type StoneSlabMaterialPrice = Readonly<{
  kind: "estimated" | "exact" | "size_required";
  primaryLabel: string;
  /** Headline amount: slab material total/range, or the known rate when size is missing. */
  primaryPrice: string;
  secondaryPrice: string | null;
  explanation: string;
  referenceSizeCount: number;
}>;
export type StoneSlabMaterialPriceRange = Readonly<{
  kind: "estimated" | "exact";
  minimumCents: number;
  maximumCents: number;
  referenceSizeCount: number;
}>;
const STONE_ID = /^tradescout-stone-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const USD = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
});

function stonePriceCents(price: unknown): number | null {
  if (typeof price !== "number" && typeof price !== "string") return null;
  const value = String(price);
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 9_999_999_999 ? cents : null;
}

function dimensionHundredths(value: string): bigint | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const inches = Number(value);
  if (!Number.isFinite(inches) || inches < 20 || inches > 220) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0") || "0");
}

/** All reference sizes must parse; otherwise a partial range could hide a larger slab. */
function referenceSlabTotals(priceCents: number, sizes: unknown): number[] | null {
  if (typeof sizes !== "string" || !sizes.trim() || sizes.length > 1000) return null;
  const parts = sizes.split(",");
  if (parts.length > 24) return null;
  const totals: number[] = [];
  for (const part of parts) {
    const match = /^\s*(\d+(?:\.\d{1,2})?)\s*[x×]\s*(\d+(?:\.\d{1,2})?)\s*$/.exec(part);
    if (!match) return null;
    const width = dimensionHundredths(match[1]);
    const height = dimensionHundredths(match[2]);
    if (width === null || height === null) return null;
    // USD/sq ft × the recorded slab face area in square inches. Round once to
    // the nearest cent, half up, with integer arithmetic to avoid float drift.
    const divisor = BigInt(144 * 10_000);
    const total = Number((BigInt(priceCents) * width * height + divisor / BigInt(2)) / divisor);
    if (!Number.isSafeInteger(total) || total <= 0) return null;
    totals.push(total);
  }
  return totals.length ? totals : null;
}

export function stoneListingPath(id: unknown): string | null {
  const key = text(id);
  return key.length <= 160 && STONE_ID.test(key)
    ? `/exchange/building-materials/${encodeURIComponent(key)}`
    : null;
}

/** Invalid prices never become $0 or a whole-slab price. No reference-price fallback. */
export function stonePriceLabel(price: unknown, unit: unknown): string | null {
  if (unit !== "sqft" && unit !== "slab") return null;
  const cents = stonePriceCents(price);
  return cents === null ? null : USD.format(cents / 100) + (unit === "sqft" ? " / sq ft" : " / slab");
}

/** Numeric counterpart to the displayed material total. Missing dimensions have no total. */
export function stoneSlabMaterialPriceRange(price: unknown, unit: unknown, referenceSizesInches: unknown, exactSlab?: unknown): StoneSlabMaterialPriceRange | null {
  const cents = stonePriceCents(price);
  if (cents === null) return null;
  if (unit === "slab") return text(exactSlab)
    ? { kind: "exact", minimumCents: cents, maximumCents: cents, referenceSizeCount: 0 }
    : null;
  if (unit !== "sqft") return null;
  const totals = referenceSlabTotals(cents, referenceSizesInches);
  return totals ? { kind: "estimated", minimumCents: Math.min(...totals),
    maximumCents: Math.max(...totals), referenceSizeCount: totals.length } : null;
}

/** A material-only full-slab price from the approved rate and recorded reference sizes. */
export function stoneSlabMaterialPrice(price: unknown, unit: unknown, referenceSizesInches: unknown, exactSlab?: unknown): StoneSlabMaterialPrice | null {
  const rate = stonePriceLabel(price, unit);
  if (!rate) return null;
  const range = stoneSlabMaterialPriceRange(price, unit, referenceSizesInches, exactSlab);
  if (unit === "slab") {
    if (!range) return null;
    return { kind: "exact", primaryLabel: "Full slab material price", primaryPrice: USD.format(range.minimumCents / 100),
      secondaryPrice: null, referenceSizeCount: 0,
      explanation: "For the identified slab. Confirm availability; delivery, fabrication and installation are separate." };
  }
  if (!range) return { kind: "size_required", primaryLabel: "Slab price TBD", primaryPrice: rate,
    secondaryPrice: null, referenceSizeCount: 0,
    explanation: "A full slab total needs confirmed dimensions. The displayed per-square-foot material rate excludes delivery, fabrication and installation." };
  return { kind: "estimated", primaryLabel: "Estimated full slab material price",
    primaryPrice: range.minimumCents === range.maximumCents ? USD.format(range.minimumCents / 100) : `${USD.format(range.minimumCents / 100)}–${USD.format(range.maximumCents / 100)}`,
    secondaryPrice: rate, referenceSizeCount: range.referenceSizeCount,
    explanation: `From ${range.referenceSizeCount === 1 ? "a recorded reference size" : `${range.referenceSizeCount} recorded reference sizes`}; confirm the selected slab's dimensions and total. Delivery, fabrication and installation are separate.` };
}

export function readStoneInquiryIntent(value: unknown): StoneInquiryIntent | null {
  return value === "availability" || value === "callback" ? value : null;
}

/** A selected stone inquiry already supplies the goal that the Start Guide asks for. */
export function isStoneInquiryPath(value: string): boolean {
  if (!value.startsWith("/exchange/building-materials/")) return false;
  const url = new URL(value, "https://tradescout.invalid");
  const id = url.pathname.slice("/exchange/building-materials/".length);
  return (
    stoneListingPath(id) === url.pathname &&
    Boolean(readStoneInquiryIntent(url.searchParams.get("inquiry")))
  );
}

export function stoneInquiryPath(id: unknown, intent: StoneInquiryIntent): string | null {
  const path = stoneListingPath(id);
  return path && readStoneInquiryIntent(intent) ? `${path}?inquiry=${intent}` : null;
}

export function stoneInquiryMessage(
  listing: { title: string; price: unknown; specifications?: Record<string, unknown> },
  intent: StoneInquiryIntent
): string {
  const name = text(listing.title)
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 200);
  if (!name || !readStoneInquiryIntent(intent))
    throw new Error("A listing and inquiry intent are required");
  const label = stonePriceLabel(listing.price, listing.specifications?.priceUnit);
  return (
    (intent === "callback"
      ? `I would like a call about ${name}.`
      : `Please confirm availability for ${name}.`) +
    (label ? ` Listed material price: ${label}.` : "") +
    " Please confirm the exact slab dimensions, available quantity, and delivery charges through TradeScout."
  );
}

export function stoneInquiryReturnPath(id: unknown, intent: StoneInquiryIntent): string | null {
  const path = stoneInquiryPath(id, intent);
  return path ? `/pre-scout-setup?mode=signin&next=${encodeURIComponent(path)}` : null;
}
