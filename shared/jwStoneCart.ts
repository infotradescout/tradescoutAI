import { z } from "zod";
import { jwStonePriceKey } from "./jwStoneMemberPricing";

export const JW_STONE_CART_STORAGE_PREFIX = "tradescout:jw-stone:member-cart:v2:";
export const JW_STONE_LEGACY_CART_STORAGE_PREFIX = "tradescout:jw-stone:member-cart:v1:";
export const JW_STONE_CART_REVIEW_PATH = "/api/u/jw-stone/member-pricing/cart-review";
export const JW_STONE_CART_MAX_LINES = 100;
export const JW_STONE_CART_REVIEW_MAX_LINES = 50;
export const jwStoneInventoryPublicIdSchema = z.string().regex(/^stone_[a-f0-9]{32}$/);
const quantitySchema = z.number().int().min(1).max(999);
const centsSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const jwStoneCartFulfillmentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("pickup") }).strict(),
  z.object({ method: z.literal("delivery"), postalCode: z.string().regex(/^\d{5}(?:-\d{4})?$/) }).strict(),
]);
export type JwStoneCartFulfillment = z.infer<typeof jwStoneCartFulfillmentSchema>;

export const jwStoneCartReviewRequestSchema = z.object({
  lines: z.array(z.object({
    inventoryPublicId: jwStoneInventoryPublicIdSchema,
    quantity: quantitySchema,
  }).strict()).min(1).max(JW_STONE_CART_REVIEW_MAX_LINES),
  fulfillment: jwStoneCartFulfillmentSchema.optional(),
}).strict().superRefine((value, context) => {
  const quantities = new Map<string, number>();
  for (const line of value.lines) {
    const total = (quantities.get(line.inventoryPublicId) || 0) + line.quantity;
    quantities.set(line.inventoryPublicId, total);
    if (total > 999) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "The combined quantity for one stock item cannot exceed 999 slabs." });
      break;
    }
  }
});
export type JwStoneCartReviewRequest = z.infer<typeof jwStoneCartReviewRequestSchema>;

/** Duplicate browser rows refer to the same physical quantity, never extra stock. */
export function combineJwStoneCartLines(lines: JwStoneCartReviewRequest["lines"]): JwStoneCartReviewRequest["lines"] {
  const quantities = new Map<string, number>();
  for (const line of lines) quantities.set(line.inventoryPublicId, (quantities.get(line.inventoryPublicId) || 0) + line.quantity);
  return [...quantities].map(([inventoryPublicId, quantity]) => ({ inventoryPublicId, quantity }));
}

const dimensionsSchema = z.object({
  length: z.number().positive().nullable().optional(),
  height: z.number().positive().nullable().optional(),
  thickness: z.number().positive().nullable().optional(),
  unit: z.enum(["in", "mm"]).nullable().optional(),
});
const lineBase = {
  inventoryPublicId: jwStoneInventoryPublicIdSchema,
  requestedQuantity: quantitySchema,
};
const unavailableLine = z.object({ ...lineBase, status: z.literal("unavailable") });
const blockedLine = z.object({
  ...lineBase,
  status: z.enum(["insufficient_quantity", "price_unavailable", "dimensions_required", "slab_quantity_required"]),
  materialName: z.string().min(1).max(160),
  availableQuantity: z.number().int().min(0),
});
const readyLine = z.object({
  ...lineBase,
  status: z.literal("ready"),
  availableQuantity: z.number().int().min(1),
  materialName: z.string().min(1).max(160),
  materialSlug: z.string().min(1).max(160),
  assetKind: z.enum(["slab", "bundle"]),
  dimensions: dimensionsSchema,
  pricingTier: z.enum(["slab", "bundle"]),
  unitRateCents: centsSchema,
  oneSlabTotalCents: centsSchema,
  lineTotalCents: centsSchema,
});
export const jwStoneCartReviewResponseSchema = z.object({
  profileSlug: z.literal("jw-stone"),
  viewerId: z.string().min(1),
  currency: z.literal("USD"),
  sourceUpdatedAt: z.string().datetime(),
  reviewedAt: z.string().datetime(),
  materialReady: z.boolean(),
  readyForCheckout: z.literal(false),
  inventoryReserved: z.literal(false),
  subtotalCents: centsSchema.nullable(),
  fulfillment: jwStoneCartFulfillmentSchema,
  deliveryFeeCents: z.null(),
  estimatedDeliveryDate: z.null(),
  lines: z.array(z.union([readyLine, blockedLine, unavailableLine])).min(1).max(JW_STONE_CART_REVIEW_MAX_LINES),
});
export type JwStoneCartReview = z.infer<typeof jwStoneCartReviewResponseSchema>;

/** Bind a response to the exact member and request; discard any unexpected private fields. */
export function parseJwStoneCartReview(value: unknown, viewerId: string, request: JwStoneCartReviewRequest): JwStoneCartReview {
  const review = jwStoneCartReviewResponseSchema.parse(value);
  const expected = combineJwStoneCartLines(request.lines);
  if (review.viewerId !== viewerId || review.lines.length !== expected.length ||
      JSON.stringify(review.fulfillment) !== JSON.stringify(request.fulfillment || { method: "pickup" })) {
    throw new Error("The cart changed. Check availability again.");
  }
  const seen = new Set<string>();
  let subtotal = 0;
  for (const line of review.lines) {
    const requested = expected.find((entry) => entry.inventoryPublicId === line.inventoryPublicId);
    if (!requested || requested.quantity !== line.requestedQuantity || seen.has(line.inventoryPublicId)) {
      throw new Error("The cart changed. Check availability again.");
    }
    seen.add(line.inventoryPublicId);
    if (line.status === "ready") {
      if (line.requestedQuantity > line.availableQuantity ||
          line.oneSlabTotalCents * line.requestedQuantity !== line.lineTotalCents) {
        throw new Error("The cart total could not be checked.");
      }
      subtotal += line.lineTotalCents;
    }
  }
  const materialReady = review.lines.every((line) => line.status === "ready");
  if (!Number.isSafeInteger(subtotal) || review.materialReady !== materialReady ||
      review.subtotalCents !== (materialReady ? subtotal : null)) {
    throw new Error("The cart total could not be checked.");
  }
  return review;
}

export type JwStoneCartSelection = Readonly<{
  id: string;
  stoneName: string;
  stoneKey: string;
  quantity: number;
  inventoryPublicId?: string;
}>;
export type JwStoneCartDraft = Omit<JwStoneCartSelection, "quantity">;

/** Restores both v1 and v2 selections, deliberately not restoring browser prices. */
export function restoreJwStoneCart(value: unknown): readonly JwStoneCartSelection[] {
  if (!Array.isArray(value) || value.length > JW_STONE_CART_MAX_LINES) return [];
  const result: JwStoneCartSelection[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 500 ||
        typeof item.stoneName !== "string" || !item.stoneName.trim() || item.stoneName.length > 160 ||
        item.stoneKey !== jwStonePriceKey(item.stoneName) ||
        !quantitySchema.safeParse(item.quantity).success || seen.has(item.id)) continue;
    const publicId = jwStoneInventoryPublicIdSchema.safeParse(item.inventoryPublicId);
    seen.add(item.id);
    result.push({ id: item.id, stoneName: item.stoneName.trim(), stoneKey: String(item.stoneKey),
      quantity: Number(item.quantity), ...(publicId.success ? { inventoryPublicId: publicId.data } : {}) });
  }
  return result;
}
