/** Price-free cart intent. Only the authenticated server review may quote a lot. */
export const JW_STONE_CART_MAX_LINES = 50;
export const JW_STONE_CART_MAX_QUANTITY = 999;
export type JwStoneCartLine = Readonly<{
  id: string;
  kind: "lot" | "catalog";
  stoneName: string;
  quantity: number;
}>;
export type JwStoneCartRequestLine = Readonly<{ inventoryPublicId: string; quantity: number }>;
export type JwStoneCartRate = Readonly<{
  unit: "square_foot" | "slab";
  sellPriceCents: number;
  bundlePriceCents?: number | null;
  bundleMinSlabs?: number | null;
}>;
export type JwStoneCartStock = Readonly<{
  publicId: string;
  materialName: string;
  materialSlug: string;
  assetKind: string;
  unit: string;
  quantity: number;
  heldQuantity: number;
  saleReady: boolean;
  dimensions: { length?: number | null; height?: number | null; unit?: "mm" | "in" | null } | null;
  rate: JwStoneCartRate | null;
}>;
export type JwStoneCartReviewLine = Readonly<{
  inventoryPublicId: string;
  requestedQuantity: number;
  status: "ready" | "unavailable" | "insufficient_quantity" | "price_unavailable" | "dimensions_required" | "unsupported_unit";
  materialName?: string;
  materialSlug?: string;
  availableQuantity?: number;
  pricingTier?: "slab" | "bundle";
  priceUnit?: "square_foot" | "slab";
  unitRateCents?: number;
  oneSlabTotalCents?: number;
  lineTotalCents?: number;
}>;
export type JwStoneCartReview = Readonly<{
  profileSlug: "jw-stone";
  viewerId: string;
  currency: "USD";
  reviewedAt: string;
  readyForRequest: boolean;
  readyForCheckout: false;
  reservationCreated: false;
  subtotalCents: number | null;
  lines: readonly JwStoneCartReviewLine[];
}>;
export class JwStoneCartInputError extends Error {}
export function isJwStoneLotId(value: unknown): value is string {
  return typeof value === "string" && /^stone_[a-f0-9]{32}$/.test(value);
}
function quantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= JW_STONE_CART_MAX_QUANTITY;
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function parseJwStoneCartRequest(value: unknown): JwStoneCartRequestLine[] {
  const body = record(value);
  if (!body || Object.keys(body).some(key => key !== "lines") || !Array.isArray(body.lines) || !body.lines.length || body.lines.length > JW_STONE_CART_MAX_LINES) throw new JwStoneCartInputError("Choose between one and 50 inventory lots.");
  const seen = new Set<string>();
  return body.lines.map(raw => {
    const line = record(raw);
    if (!line || Object.keys(line).some(key => key !== "inventoryPublicId" && key !== "quantity") || !isJwStoneLotId(line.inventoryPublicId) || !quantity(line.quantity)) throw new JwStoneCartInputError("Each lot needs a valid identifier and a whole slab quantity from 1 to 999.");
    if (seen.has(line.inventoryPublicId)) throw new JwStoneCartInputError("Each inventory lot may appear only once in the cart.");
    seen.add(line.inventoryPublicId);
    return { inventoryPublicId: line.inventoryPublicId, quantity: line.quantity };
  });
}
/** Unknown client properties (including stored prices/costs) are never retained. */
export function normalizeJwStoneCart(value: unknown): JwStoneCartLine[] {
  if (!Array.isArray(value)) return [];
  const result: JwStoneCartLine[] = [];
  const seen = new Set<string>();
  for (const raw of value.slice(0, 500)) {
    const line = record(raw);
    if (!line || typeof line.id !== "string" || !line.id || line.id.length > 500 || /[\u0000-\u001f]/.test(line.id) || typeof line.stoneName !== "string" || !line.stoneName.trim() || line.stoneName.length > 160 || !quantity(line.quantity) || seen.has(line.id)) continue;
    const kind = line.kind === "lot" && isJwStoneLotId(line.id) ? "lot" : line.kind === "catalog" ? "catalog" : null;
    if (!kind) continue;
    seen.add(line.id);
    result.push({ id: line.id, kind, stoneName: line.stoneName.trim(), quantity: line.quantity });
    if (result.length === JW_STONE_CART_MAX_LINES) break;
  }
  return result;
}
export function migrateJwStoneLegacyCart(value: unknown): JwStoneCartLine[] {
  if (!Array.isArray(value)) return [];
  // Legacy IDs identify a material/dimension estimate, never a particular lot.
  return normalizeJwStoneCart(value.map(raw => ({ ...record(raw), kind: "catalog" })));
}
export function addJwStoneCartLine(lines: readonly JwStoneCartLine[], next: Omit<JwStoneCartLine, "quantity">): JwStoneCartLine[] {
  const valid = normalizeJwStoneCart([{ ...next, quantity: 1 }])[0];
  if (!valid) throw new JwStoneCartInputError("This stone cannot be added to the cart.");
  const current = normalizeJwStoneCart(lines);
  const found = current.find(line => line.id === valid.id);
  if (found) {
    if (found.quantity === JW_STONE_CART_MAX_QUANTITY) throw new JwStoneCartInputError("The maximum quantity per lot is 999 slabs.");
    return current.map(line => line.id === valid.id ? { ...line, quantity: line.quantity + 1 } : line);
  }
  if (current.length === JW_STONE_CART_MAX_LINES) throw new JwStoneCartInputError("The cart holds up to 50 selections. Remove one before adding another.");
  return [...current, valid];
}
export function setJwStoneCartQuantity(lines: readonly JwStoneCartLine[], id: string, value: number): JwStoneCartLine[] {
  if (value === 0) return lines.filter(line => line.id !== id);
  if (!quantity(value)) throw new JwStoneCartInputError("Enter a whole slab quantity from 1 to 999.");
  return lines.map(line => line.id === id ? { ...line, quantity: value } : line);
}
const cents = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 10_000_000;
/** Quotes only usable slab quantities; reserved stock and catalog suggestions cannot masquerade as inventory. */
export function reviewJwStoneCart(viewerId: string, requested: readonly JwStoneCartRequestLine[], stock: readonly JwStoneCartStock[], now = new Date()): JwStoneCartReview {
  const requests = parseJwStoneCartRequest({ lines: requested });
  const byId = new Map(stock.map(item => [item.publicId, item]));
  const lines: JwStoneCartReviewLine[] = requests.map(request => {
    const base = { inventoryPublicId: request.inventoryPublicId, requestedQuantity: request.quantity };
    const item = byId.get(request.inventoryPublicId);
    if (!item?.saleReady) return { ...base, status: "unavailable" };
    const named = { ...base, materialName: item.materialName, materialSlug: item.materialSlug };
    if (!["slab", "bundle", "a_frame"].includes(item.assetKind) || !["slab", "slabs"].includes(item.unit.trim().toLowerCase())) return { ...named, status: "unsupported_unit" };
    if (!Number.isFinite(item.quantity) || !Number.isFinite(item.heldQuantity) || item.quantity < 0 || item.heldQuantity < 0) return { ...base, status: "unavailable" };
    const availableQuantity = Math.max(0, Math.floor(item.quantity - item.heldQuantity));
    const counted = { ...named, availableQuantity };
    if (request.quantity > availableQuantity) return { ...counted, status: "insufficient_quantity" };
    const rate = item.rate;
    if (!rate || !cents(rate.sellPriceCents) || !["slab", "square_foot"].includes(rate.unit)) return { ...counted, status: "price_unavailable" };
    const bundle = Number.isInteger(rate.bundleMinSlabs) && Number(rate.bundleMinSlabs) >= 1 && request.quantity >= Number(rate.bundleMinSlabs);
    if (bundle && !cents(rate.bundlePriceCents)) return { ...counted, status: "price_unavailable" };
    const unitRateCents = bundle ? rate.bundlePriceCents! : rate.sellPriceCents;
    let oneSlabTotalCents = unitRateCents;
    if (rate.unit === "square_foot") {
      const dimensions = item.dimensions;
      const scale = dimensions?.unit === "in" ? 1 : dimensions?.unit === "mm" ? 1 / 25.4 : null;
      const length = dimensions?.length, height = dimensions?.height;
      if (!scale || typeof length !== "number" || typeof height !== "number" || !Number.isFinite(length) || !Number.isFinite(height) || length <= 0 || height <= 0) return { ...counted, status: "dimensions_required" };
      oneSlabTotalCents = Math.round(length * scale * height * scale / 144 * unitRateCents);
    }
    const lineTotalCents = oneSlabTotalCents * request.quantity;
    if (!Number.isSafeInteger(lineTotalCents) || lineTotalCents <= 0) return { ...counted, status: "price_unavailable" };
    return { ...counted, status: "ready", priceUnit: rate.unit, pricingTier: bundle ? "bundle" : "slab", unitRateCents, oneSlabTotalCents, lineTotalCents };
  });
  const total = lines.reduce((sum, line) => sum + (line.lineTotalCents ?? 0), 0);
  const readyForRequest = lines.every(line => line.status === "ready") && Number.isSafeInteger(total);
  return { profileSlug: "jw-stone", viewerId, currency: "USD", reviewedAt: now.toISOString(), readyForRequest, readyForCheckout: false, reservationCreated: false, subtotalCents: readyForRequest ? total : null, lines };
}
