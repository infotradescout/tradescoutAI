import { z } from "zod";
import {
  combineJwStoneCartLines,
  jwStoneCartFulfillmentSchema,
  jwStoneInventoryPublicIdSchema,
} from "./jwStoneCart";
import { jwStoneCartHoldIdSchema } from "./jwStoneCartHoldRecovery";

export const JW_STONE_CART_HOLD_MINUTES = 30;
export {
  JW_STONE_CART_HOLD_PATH,
  jwStoneCartHoldIdSchema,
  jwStoneCartHoldStatusSchema,
  jwStoneCartHoldRecoverySchema,
  jwStoneHoldRemainingSeconds,
  parseJwStoneCartHoldRecovery,
  type JwStoneCartHoldStatus,
} from "./jwStoneCartHoldRecovery";
export const jwStoneCartHoldRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    lines: z
      .array(
        z
          .object({
            inventoryPublicId: jwStoneInventoryPublicIdSchema,
            quantity: z.number().int().min(1).max(999),
          })
          .strict()
      )
      .min(1)
      .max(50),
    // This is only a stale-review comparison, never a price supplied to the ledger.
    expectedSubtotalCents: z.number().int().positive().max(2_147_483_647),
    fulfillment: jwStoneCartFulfillmentSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (combineJwStoneCartLines(value.lines).some((line) => line.quantity > 999)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message: "Combined stock quantity exceeds 999 slabs.",
      });
    }
  });
export type JwStoneCartHoldRequest = z.infer<typeof jwStoneCartHoldRequestSchema>;
export const jwStoneCartHoldReceiptSchema = z
  .object({
    reservationId: jwStoneCartHoldIdSchema,
    status: z.enum(["active", "released", "expired"]),
    expiresAt: z.string().datetime(),
    serverTime: z.string().datetime(),
    currency: z.literal("USD"),
    materialSubtotalCents: z.number().int().positive().max(2_147_483_647),
    paymentStatus: z.literal("not_started"),
    readyForCheckout: z.literal(false),
    fulfillment: jwStoneCartFulfillmentSchema,
    deliveryFeeCents: z.null(),
    estimatedDeliveryDate: z.null(),
    lines: z
      .array(
        z
          .object({
            inventoryPublicId: jwStoneInventoryPublicIdSchema,
            materialName: z.string().min(1).max(180),
            quantity: z.number().int().min(1).max(999),
            unitRateCents: z.number().int().positive().max(2_147_483_647),
            oneSlabTotalCents: z.number().int().positive().max(2_147_483_647),
            lineTotalCents: z.number().int().positive().max(2_147_483_647),
            pricingTier: z.enum(["slab", "bundle"]),
          })
          .strict()
      )
      .min(1)
      .max(50),
  })
  .strict();

export type JwStoneCartHoldReceipt = z.infer<typeof jwStoneCartHoldReceiptSchema>;

export const jwStoneCartHoldReleaseSchema = z
  .object({
    reservationId: jwStoneCartHoldIdSchema,
    status: z.enum(["released", "expired"]),
  })
  .strict();

export class JwStoneCartHoldError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409 | 503,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "JwStoneCartHoldError";
  }
}
