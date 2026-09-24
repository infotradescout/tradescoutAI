import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac, timingSafeEqual } from "node:crypto";
import { stonePriceLabel, stoneSlabMaterialPriceRange } from "../../shared/exchangeStoneBuyerFlow";

export const STONE_CHANNEL = "tradescout_stone_retail";
export const STONE_AUDIENCE = "US_EXCEPT_PENSACOLA_FL_CITY";
export const STONE_STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
const names = "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming".split("|");
const stateNames = new Map(names.map((name, index) => [name.toUpperCase(), STONE_STATES[index]]));
export type StoneMarket = { city?: unknown; state?: unknown; country?: unknown };
export type StoneAudience = { allowed: boolean; reason: "eligible" | "pensacola" | "outside_us" | "location_required"; market: { city: string; state: string; country: string } };
export type StonePublicItem = { id: string; sellerId: string; categoryId: string; category: string; title: string; description: string; price: number; images: string[]; specifications: Record<string, unknown>; createdAt: string | null; [key: string]: unknown };
export type StoneDiscoveryContext = { audience: StoneAudience; items: StonePublicItem[]; query: Record<string, unknown>; feed: boolean; publicationReady: boolean; unavailable?: boolean };
const contexts = new AsyncLocalStorage<StoneDiscoveryContext>();
const scalar = (value: unknown) => typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ") : "";

/** An explicit city, not its county, postal prefix, radius or surrounding market. */
export function stoneAudience(location?: StoneMarket | null): StoneAudience {
  const market = { city: scalar(location?.city), state: scalar(location?.state).toUpperCase(), country: scalar(location?.country).toUpperCase() };
  market.state = stateNames.get(market.state) || market.state;
  const result = (reason: StoneAudience["reason"]): StoneAudience => ({ allowed: reason === "eligible", reason, market });
  if (!location || [location.city, location.state, location.country].some(value => value != null && (typeof value !== "string" || value.length > 160))) return result("location_required");
  if (market.country && !["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(market.country)) return result("outside_us");
  if (!STONE_STATES.includes(market.state)) return result("location_required");
  market.country = "US";
  if (market.state === "FL" && !market.city) return result("location_required");
  return result(market.state === "FL" && market.city.toLowerCase() === "pensacola" ? "pensacola" : "eligible");
}

export function resolveStoneAudience(viewer?: StoneMarket, selected?: StoneMarket, remembered?: StoneMarket): StoneAudience {
  const known = stoneAudience(viewer);
  if (known.reason === "pensacola" || known.reason === "outside_us") return known;
  return selected ? stoneAudience(selected) : remembered ? stoneAudience(remembered) : known;
}

/** Public links use only a validated market, never arbitrary request query or attribution tags. */
export function audienceQualifiedStonePath(path: string, market?: StoneMarket | null): string | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("?") || path.includes("#")) return null;
  const audience = stoneAudience(market);
  if (!audience.allowed) return null;
  const params = new URLSearchParams();
  params.set("audienceState", audience.market.state);
  if (audience.market.state === "FL") params.set("audienceCity", audience.market.city);
  params.set("audienceCountry", "US");
  return `${path}?${params.toString()}`;
}
export function withStoneDiscovery<T>(context: StoneDiscoveryContext, callback: () => T): T { return contexts.run(context, callback); }
export function stoneDiscoveryContext(): StoneDiscoveryContext | undefined { return contexts.getStore(); }
export function isStoneDiscoveryRow(value: any): boolean { return String(value?.id || "").startsWith("tradescout-stone-") || value?.specifications?.commerceChannel === STONE_CHANNEL; }
export function currentPublicStone(id: unknown): StonePublicItem | null {
  const context = contexts.getStore();
  return context?.audience.allowed ? context.items.find(item => item.id === id) || null : null;
}

function iso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function cents(value: unknown): number | null {
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) return null;
  const [whole, fraction = ""] = String(value).split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 9999999999 ? amount : null;
}

/** Compatible with the existing staged publication manifest; never approves a reference price. */
export function stonePublicationSignature(row: any, secret: string): string {
  if (secret.length < 24) throw new Error("Publication signing secret is required");
  const s = row?.specifications || {};
  const fields = { version: 1, id: row.id, sellerId: row.sellerId, categoryId: row.categoryId,
    title: row.title, description: row.description, priceCents: cents(row.price), currency: "USD",
    status: row.status, images: row.images, expiresAt: iso(row.expiresAt), channel: s.commerceChannel,
    audience: s.retailAudience, sellerBrand: s.sellerBrand, priceUnit: s.priceUnit, material: s.material,
    referenceSizesInches: s.referenceSizesInches, exactSlab: s.exactSlab || null,
    approvedBy: s.retailPublication?.approvedBy, approvedAt: s.retailPublication?.approvedAt,
    assetSha256: s.retailPublication?.assetSha256, availability: s.availability,
    requiresBuyerVerification: row.requiresBuyerVerification === true, priceNegotiable: row.priceNegotiable === true };
  return createHmac("sha256", secret).update("TradeScout.Exchange.Retail.v1\n").update(JSON.stringify(fields)).digest("hex");
}

export function validStonePublication(row: any, sellerId: string, secret: string, now = Date.now()): boolean {
  if (!row || !sellerId || row.sellerId !== sellerId || secret.length < 24) return false;
  const s = row.specifications, approval = s?.retailPublication;
  if (!/^tradescout-stone-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.id) || row.id.length > 160 || !scalar(row.categoryId)) return false;
  if (row.status !== "active" || s?.commerceChannel !== STONE_CHANNEL || s?.sellerBrand !== "TradeScout" || s?.retailAudience !== STONE_AUDIENCE) return false;
  if (!stonePriceLabel(row.price, s.priceUnit) || row.requiresBuyerVerification === true || row.priceNegotiable === true) return false;
  if (row.expiresAt && (!iso(row.expiresAt) || Date.parse(iso(row.expiresAt)!) <= now)) return false;
  if (!scalar(approval?.approvedBy) || !iso(approval?.approvedAt) || Date.parse(approval.approvedAt) > now + 300000) return false;
  if (!/^[a-f0-9]{64}$/.test(approval?.assetSha256 || "") || !/^[a-f0-9]{64}$/.test(approval?.signature || "")) return false;
  if (s.priceUnit === "slab" && !scalar(s.exactSlab)) return false;
  if (!Array.isArray(row.images) || row.images.length !== 1 || row.images[0] !== `/api/exchange/stone-media/${row.id}`) return false;
  if (typeof row.title !== "string" || !row.title.trim() || row.title.length > 200 || typeof row.description !== "string" || !row.description.trim() || row.description.length > 4000) return false;
  if (/(?:\bjw\s*stone\b|jwstonelogistics|fabricator\s+price|supplier\s+cost|https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test([row.title, row.description, row.condition, s.material, s.referenceSizesInches, s.exactSlab].map(scalar).join(" "))) return false;
  return timingSafeEqual(Buffer.from(approval.signature, "hex"), Buffer.from(stonePublicationSignature(row, secret), "hex"));
}

/** Explicit allowlist. Supplier economics, origin URLs and approval records never reach the buyer. */
export function projectPublicStone(row: any): StonePublicItem {
  const s = row.specifications;
  return { id: row.id, sellerId: row.sellerId, categoryId: row.categoryId, category: "building-materials",
    title: row.title, description: row.description, price: cents(row.price)! / 100, currency: "USD",
    priceUnit: s.priceUnit, priceLabel: stonePriceLabel(row.price, s.priceUnit), priceType: "fixed", pricingMode: "fixed",
    images: [...row.images], primaryImageIndex: 0, brand: "TradeScout", sellerName: "TradeScout", businessName: "TradeScout",
    seller: { id: row.sellerId, name: "TradeScout", businessName: "TradeScout", verified: row.isSellerVerified === true },
    sellerVerified: row.isSellerVerified === true, condition: scalar(row.condition), status: "active", sourceType: "marketplace_listing",
    location: "United States", city: "", state: "", county: "", shippingCost: null, willShip: false,
    isLocalPickupOnly: false, localPickupOnly: false, requiresBuyerVerification: false,
    inStock: null, itemStockQuantity: null, availability: "confirm_before_purchase",
    specifications: { commerceChannel: STONE_CHANNEL, sellerBrand: "TradeScout", priceUnit: s.priceUnit,
      material: scalar(s.material) || null, referenceSizesInches: scalar(s.referenceSizesInches) || null,
      ...(s.priceUnit === "slab" ? { exactSlab: scalar(s.exactSlab) } : {}),
      availability: "confirm_before_purchase", shippingPolicy: "quoted_separately" },
    createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), expiresAt: iso(row.expiresAt),
    contactAccess: { mode: "decision_card_required", decisionScope: `marketplace_listing:${row.id}` } };
}

const FILTERS = new Set(["categoryId", "category", "q", "search", "searchQuery", "minPrice", "maxPrice", "priceMin", "priceMax", "material", "sort", "sortBy", "offset", "limit", "state", "stateCode", "county", "countyFips", "city", "audienceState", "audienceCity", "audienceCountry", "utm_source", "utm_medium", "utm_campaign", "utm_content"]);
function priceBoundCents(value: unknown): number | null {
  if (value == null || value === "") return null;
  const raw = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return NaN;
  const [whole, fraction = ""] = raw.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : NaN;
}
export function filterStoneDiscovery(items: StonePublicItem[], query: Record<string, unknown>): StonePublicItem[] {
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    // Vehicle filters, unsupported structured values and future category filters cannot widen stone results.
    if (!FILTERS.has(key) || (typeof value !== "string" && typeof value !== "number")) return [];
  }
  const categories = [query.categoryId, query.category].filter(value => value != null && value !== "").map(scalar);
  const search = scalar(query.q ?? query.search ?? query.searchQuery).toLowerCase();
  const material = scalar(query.material).toLowerCase();
  const minimum = query.minPrice ?? query.priceMin, maximum = query.maxPrice ?? query.priceMax;
  const minimumCents = priceBoundCents(minimum), maximumCents = priceBoundCents(maximum);
  if (Number.isNaN(minimumCents) || Number.isNaN(maximumCents) ||
    (minimumCents !== null && maximumCents !== null && minimumCents > maximumCents)) return [];
  const withinTotalBand = (item: StonePublicItem): boolean => {
    if (minimumCents === null && maximumCents === null) return true;
    // A selected price band must contain every recorded slab total, not merely
    // the per-square-foot rate or the cheapest size. TBD totals cannot qualify.
    const range = stoneSlabMaterialPriceRange(item.price, item.specifications.priceUnit,
      item.specifications.referenceSizesInches, item.specifications.exactSlab);
    return range !== null && (minimumCents === null || range.minimumCents >= minimumCents) &&
      (maximumCents === null || range.maximumCents <= maximumCents);
  };
  return items.filter(item => categories.every(category => ["all", "building-materials", "Building Materials & Surfaces", item.categoryId].includes(category)) &&
    (!search || `${item.title} ${item.description} ${item.specifications.material || ""}`.toLowerCase().includes(search)) &&
    (!material || String(item.specifications.material || "").toLowerCase() === material) &&
    withinTotalBand(item));
}
export function currentStoneFeedItems(): StonePublicItem[] {
  const context = contexts.getStore();
  return context?.feed && context.audience.allowed ? filterStoneDiscovery(context.items, context.query) : [];
}
