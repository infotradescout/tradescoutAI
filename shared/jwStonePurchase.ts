import { z } from "zod";
import { jwStoneCartReviewRequestSchema, combineJwStoneCartLines } from "./jwStoneCart";
import { jwStoneSaleIntakeSchema } from "./jwStoneCheckout";

export const JW_STONE_PURCHASE_PATH = "/api/u/jw-stone/orders/purchases";
export const JW_STONE_PURCHASE_TERMS = "Send these slabs to JW Stone at their listed material prices. This is not a price offer or payment authorization. JW Stone must confirm tax, delivery and the final payable total; you then approve that total before paying.";
export const jwStonePurchaseRequestSchema = z.object({
  operationId: z.string().uuid(),
  selection: jwStoneCartReviewRequestSchema,
  expectedSubtotalCents: z.number().int().positive().max(99_999_999),
  termsAcknowledged: z.literal(true),
}).strict();
export type JwStonePurchaseRequest = z.infer<typeof jwStonePurchaseRequestSchema>;
export const jwStonePurchaseIntakeSchema = jwStoneSaleIntakeSchema.omit({ offeredTotalCents: true }).extend({
  intent: z.literal("purchase"),
  pricingSource: z.enum(["listed_prices", "owned_reservation"]),
  reservationId: z.string().regex(/^jwh_[a-f0-9]{32}$/).nullable(),
});
export type JwStonePurchaseIntake = z.infer<typeof jwStonePurchaseIntakeSchema>;
export function canonicalJwStonePurchase(input: JwStonePurchaseRequest) {
  return {
    selection: { lines: combineJwStoneCartLines(input.selection.lines).sort((a,b) => a.inventoryPublicId.localeCompare(b.inventoryPublicId)), fulfillment: input.selection.fulfillment || { method: "pickup" as const } },
    expectedSubtotalCents: input.expectedSubtotalCents,
    termsAcknowledged: input.termsAcknowledged,
  };
}
