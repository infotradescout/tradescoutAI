/** Pure presentation helpers. Contact authority remains in the existing Decision Card flow. */
export type StoneInquiryIntent = "availability" | "callback";
export type StonePriceUnit = "sqft" | "slab";
const STONE_ID = /^tradescout-stone-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

export function stoneListingPath(id: unknown): string | null {
  const key = text(id);
  return key.length <= 160 && STONE_ID.test(key)
    ? `/exchange/building-materials/${encodeURIComponent(key)}` : null;
}

/** Invalid prices never become $0 or a whole-slab price. No reference-price fallback. */
export function stonePriceLabel(price: unknown, unit: unknown): string | null {
  if (unit !== "sqft" && unit !== "slab") return null;
  if (typeof price !== "number" && typeof price !== "string") return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(price))) return null;
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + (unit === "sqft" ? " / sq ft" : " / slab");
}

export function readStoneInquiryIntent(value: unknown): StoneInquiryIntent | null {
  return value === "availability" || value === "callback" ? value : null;
}

/** A selected stone inquiry already supplies the goal that the Start Guide asks for. */
export function isStoneInquiryPath(value: string): boolean {
  if (!value.startsWith("/exchange/building-materials/")) return false;
  const url = new URL(value, "https://tradescout.invalid");
  const id = url.pathname.slice("/exchange/building-materials/".length);
  return stoneListingPath(id) === url.pathname && Boolean(readStoneInquiryIntent(url.searchParams.get("inquiry")));
}

export function stoneInquiryPath(id: unknown, intent: StoneInquiryIntent): string | null {
  const path = stoneListingPath(id);
  return path && readStoneInquiryIntent(intent) ? `${path}?inquiry=${intent}` : null;
}

export function stoneInquiryMessage(listing: { title: string; price: unknown; specifications?: Record<string, unknown> }, intent: StoneInquiryIntent): string {
  const name = text(listing.title).replace(/[\r\n\t]+/g, " ").slice(0, 200);
  if (!name || !readStoneInquiryIntent(intent)) throw new Error("A listing and inquiry intent are required");
  const label = stonePriceLabel(listing.price, listing.specifications?.priceUnit);
  return (intent === "callback" ? `I would like a call about ${name}.` : `Please confirm availability for ${name}.`) +
    (label ? ` Listed material price: ${label}.` : "") +
    " Please confirm the exact slab dimensions, available quantity, and delivery charges through TradeScout.";
}

export function stoneInquiryReturnPath(id: unknown, intent: StoneInquiryIntent): string | null {
  const path = stoneInquiryPath(id, intent);
  return path ? `/pre-scout-setup?mode=signin&next=${encodeURIComponent(path)}` : null;
}
