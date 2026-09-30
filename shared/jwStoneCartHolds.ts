import { z } from "zod";
import { combineJwStoneCartLines, jwStoneCartFulfillmentSchema, jwStoneInventoryPublicIdSchema } from "./jwStoneCart";

export const JW_STONE_CART_HOLD_MINUTES = 30;
export const JW_STONE_CART_HOLD_PATH = "/api/u/jw-stone/member-pricing/holds";
export const jwStoneCartHoldIdSchema = z.string().regex(/^jwh_[a-f0-9]{32}$/);
export const jwStoneCartHoldRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  lines: z.array(z.object({
    inventoryPublicId: jwStoneInventoryPublicIdSchema,
    quantity: z.number().int().min(1).max(999),
  }).strict()).min(1).max(50),
  // This is only a stale-review comparison, never a price supplied to the ledger.
  expectedSubtotalCents: z.number().int().positive().max(2_147_483_647),
  fulfillment: jwStoneCartFulfillmentSchema,
}).strict().superRefine((value, context) => {
  if (combineJwStoneCartLines(value.lines).some((line) => line.quantity > 999)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["lines"], message: "Combined stock quantity exceeds 999 slabs." });
  }
});
export type JwStoneCartHoldRequest = z.infer<typeof jwStoneCartHoldRequestSchema>;
export type JwStoneCartHoldReceipt = Readonly<{
  reservationId: string;
  status: "active" | "released" | "expired";
  expiresAt: string;
  serverTime: string;
  currency: "USD";
  materialSubtotalCents: number;
  paymentStatus: "not_started";
  readyForCheckout: false;
  fulfillment: JwStoneCartHoldRequest["fulfillment"];
  deliveryFeeCents: null;
  estimatedDeliveryDate: null;
  lines: readonly Readonly<{
    inventoryPublicId: string;
    materialName: string;
    quantity: number;
    unitRateCents: number;
    oneSlabTotalCents: number;
    lineTotalCents: number;
    pricingTier: "slab" | "bundle";
  }>[];
}>;

export class JwStoneCartHoldError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409 | 503,
    public readonly code: string, message: string) { super(message); this.name = "JwStoneCartHoldError"; }
}
