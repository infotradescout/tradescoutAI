/** JW Stone employee receiving. Prices are NEVER part of the public inventory projection. */
export type JwStoneReceipt = {
  receiptId: string;
  materialName: string;
  materialFamily: string;
  materialClass: "natural_stone" | "engineered_stone";
  lotLabel: string;
  quantity: number;
  length: number;
  height: number;
  dimensionUnit: "in" | "mm";
  thicknessMm: number;
  finish: string;
  locationLabel: string;
  priceUnit: "square_foot" | "slab";
  sellPriceCents: number;
  bundlePriceCents: number | null;
  bundleMinSlabs: number | null;
  landedCostCents: number | null;
  notes: string;
};
export class JwStoneReceivingInputError extends Error {}
export const JW_STONE_RECEIVING_MAX_PHOTOS = 8;
export const JW_STONE_RECEIVING_MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseJwStoneReceipt(value: unknown): JwStoneReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new JwStoneReceivingInputError("Enter the arrival details.");
  const v = value as Record<string, unknown>;
  const text = (key: string, max: number, optional = false) => {
    const s = typeof v[key] === "string" ? (v[key] as string).trim() : "";
    if ((!s && !optional) || s.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) throw new JwStoneReceivingInputError(`Check ${key}.`);
    return s;
  };
  const number = (key: string, max: number, integer = false, optional = false, allowZero = false) => {
    if (optional && (v[key] === null || v[key] === undefined)) return null;
    const n = v[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < (allowZero ? 0 : Number.MIN_VALUE) || n > max || (integer && !Number.isInteger(n))) throw new JwStoneReceivingInputError(`Check ${key}.`);
    return n;
  };
  const oneOf = <T extends string>(key: string, choices: readonly T[]): T => {
    if (!choices.includes(v[key] as T)) throw new JwStoneReceivingInputError(`Choose ${key}.`);
    return v[key] as T;
  };
  const receiptId = text("receiptId", 36).toLowerCase();
  if (!UUID.test(receiptId)) throw new JwStoneReceivingInputError("Invalid receiving identifier. Start a new arrival.");
  const result: JwStoneReceipt = {
    receiptId, materialName: text("materialName", 160), materialFamily: text("materialFamily", 80),
    materialClass: oneOf("materialClass", ["natural_stone", "engineered_stone"]),
    lotLabel: text("lotLabel", 80), quantity: number("quantity", 10000, true)!,
    length: number("length", 10000)!, height: number("height", 10000)!,
    dimensionUnit: oneOf("dimensionUnit", ["in", "mm"]), thicknessMm: number("thicknessMm", 1000)!,
    finish: text("finish", 80), locationLabel: text("locationLabel", 160),
    priceUnit: oneOf("priceUnit", ["square_foot", "slab"]),
    sellPriceCents: number("sellPriceCents", 10000000, true)!,
    bundlePriceCents: number("bundlePriceCents", 10000000, true, true),
    bundleMinSlabs: number("bundleMinSlabs", 10000, true, true),
    landedCostCents: number("landedCostCents", 10000000, true, true, true), notes: text("notes", 2000, true),
  };
  if (Object.keys(v).some(key => !Object.prototype.hasOwnProperty.call(result, key))) throw new JwStoneReceivingInputError("Unexpected receiving field.");
  if ((result.bundlePriceCents === null) !== (result.bundleMinSlabs === null)) throw new JwStoneReceivingInputError("Enter both the bundle rate and minimum slab quantity, or leave both blank.");
  if (!jwStoneReceivingMaterialSlug(result.materialName)) throw new JwStoneReceivingInputError("Enter a material name containing letters or numbers.");
  return result;
}
export function jwStoneReceivingMaterialSlug(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120).replace(/-$/, "");
}
export function jwStoneReceiptPublicId(receiptId: string): string {
  if (!UUID.test(receiptId)) throw new JwStoneReceivingInputError("Invalid receiving identifier.");
  return `stone_${receiptId.toLowerCase().replace(/-/g, "")}`;
}
export function jwStoneReceiptDimensions(receipt: JwStoneReceipt) {
  const scale = receipt.dimensionUnit === "in" ? 25.4 : 1;
  return { length: Math.round(receipt.length * scale * 1000) / 1000, height: Math.round(receipt.height * scale * 1000) / 1000, thickness: receipt.thicknessMm, unit: "mm" as const };
}
export function jwStoneReceiptMemberPrice(receipt: JwStoneReceipt) {
  return { publicId: jwStoneReceiptPublicId(receipt.receiptId), currency: "USD" as const, unit: receipt.priceUnit, sellPriceCents: receipt.sellPriceCents, bundlePriceCents: receipt.bundlePriceCents, bundleMinSlabs: receipt.bundleMinSlabs };
}
/** Exact decimal dollars to integer cents; blank is optional, never a zero selling price. */
export function jwStoneReceivingCents(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text)) throw new JwStoneReceivingInputError("Prices must be dollar amounts with no more than two decimal places.");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents > 10000000) throw new JwStoneReceivingInputError("Price is too large.");
  return cents;
}
export function isManuallyAssignedJwStoneEmployee(userId: string, configuredUserIds: string): boolean {
  return Boolean(userId.trim()) && configuredUserIds.split(/[\s,]+/).filter(Boolean).includes(userId.trim());
}

/** This path admits only sanitized receiving JPEGs, never Drive receipts or arbitrary keys. */
export function jwStoneReceivingPhotoKey(receiptId: string, fileName: string): string | null {
  if (!UUID.test(receiptId) || receiptId !== receiptId.toLowerCase() || !/^[1-8]-[a-f0-9]{20}\.jpg$/.test(fileName)) return null;
  return `public-media/images/businesses/jw-stone/receiving/${receiptId}/${fileName}`;
}
