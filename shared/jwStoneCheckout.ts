import { z } from "zod";
import { jwStoneInventoryPublicIdSchema, jwStoneCartFulfillmentSchema, JW_STONE_CART_REVIEW_MAX_LINES } from "./jwStoneCart";

export const JW_STONE_ORDERS_PATH = "/api/u/jw-stone/orders";
export const JW_STONE_ORDERS_PAGE = "/jw-stone/orders";
export const JW_STONE_SALE_EVENT = "jw_stone_sale_v1";
export const jwStonePaymentMethodSchema = z.enum(["ach", "card"]);
export type JwStonePaymentMethod = z.infer<typeof jwStonePaymentMethodSchema>;
const cents = z.number().int().nonnegative().max(99_999_999);
export const jwStoneSaleLineSchema = z.object({
  inventoryPublicId: jwStoneInventoryPublicIdSchema,
  materialName: z.string().trim().min(1).max(180),
  quantity: z.number().int().min(1).max(999),
  dimensions: z.object({ length: z.number().positive().finite(), height: z.number().positive().finite(), unit: z.enum(["in", "mm"]) }).passthrough(),
  unitRateCents: cents.positive(), lineTotalCents: cents.positive(), pricingTier: z.enum(["slab", "bundle"]),
});
export const jwStoneSaleIntakeSchema = z.object({
  scope: z.enum(["stone", "cart"]), currency: z.literal("USD"), status: z.literal("pending_review"),
  paymentAllowed: z.literal(false), inventoryReserved: z.literal(false), offeredTotalCents: cents.positive(), listedSubtotalCents: cents.positive(),
  fulfillment: jwStoneCartFulfillmentSchema, bundleApplied: z.boolean(), lines: z.array(jwStoneSaleLineSchema).min(1).max(JW_STONE_CART_REVIEW_MAX_LINES),
});
export type JwStoneSaleIntake = z.infer<typeof jwStoneSaleIntakeSchema>;
export const jwStoneFinalQuoteSchema = z.object({
  id: z.string().uuid(), revision: z.number().int().positive(), materialCents: cents.positive(), taxCents: cents, deliveryCents: cents, totalCents: cents.positive(),
  expiresAt: z.string().datetime(), issuedAt: z.string().datetime(), issuedBy: z.string().min(1),
  decision: z.enum(["accept_offer", "counter_offer", "confirm_purchase"]), notes: z.string().max(2000),
}).refine(q => q.totalCents === q.materialCents + q.taxCents + q.deliveryCents, "Quote totals do not match");
export type JwStoneFinalQuote = z.infer<typeof jwStoneFinalQuoteSchema>;
export const jwStoneQuoteAcceptanceSchema = z.object({
  quoteId: z.string().uuid(), quoteRevision: z.number().int().positive(),
  totalCents: cents.positive(), acceptedBy: z.string().min(1), acceptedAt: z.string().datetime(),
}).strict();
export type JwStoneQuoteAcceptance = z.infer<typeof jwStoneQuoteAcceptanceSchema>;
const commandBase = { operationId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() };
export const jwStoneSaleCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...commandBase, action: z.literal("quote"), decision: z.enum(["accept_offer", "counter_offer", "confirm_purchase"]), materialCents: cents.positive(), taxCents: cents, deliveryCents: cents, expiresAt: z.string().datetime(), notes: z.string().trim().max(2000) }).strict(),
  z.object({ ...commandBase, action: z.literal("decline"), notes: z.string().trim().min(1).max(2000) }).strict(),
  z.object({ ...commandBase, action: z.literal("accept_quote"), quoteId: z.string().uuid(), totalCents: cents.positive(), acceptFinalQuote: z.literal(true) }).strict(),
  z.object({ ...commandBase, action: z.literal("checkout"), quoteId: z.string().uuid(), totalCents: cents.positive(), method: jwStonePaymentMethodSchema, acceptFinalQuote: z.literal(true) }).strict(),
]);
export type JwStoneSaleCommand = z.infer<typeof jwStoneSaleCommandSchema>;
export type JwStonePaymentOutcome = "open" | "processing" | "paid" | "failed" | "expired" | "needs_review";
export type JwStoneCheckoutAttempt = {
  id: string; quoteId: string; method: JwStonePaymentMethod; accountId: string; live: boolean; returnOrigin: string;
  createdAt: string; expiresAt: string; sessionId: string | null; url: string | null; outcome: JwStonePaymentOutcome | "creating";
};
export type JwStoneSaleState = {
  revision: number;
  status: "pending_review" | "quoted" | "declined" | "checkout" | "processing" | "paid" | "payment_failed" | "payment_expired" | "needs_review";
  quote: JwStoneFinalQuote | null; attempt: JwStoneCheckoutAttempt | null;
  // Optional for historical stored states. A revised quote always clears prior consent.
  quoteAcceptance?: JwStoneQuoteAcceptance | null;
  allocations: { positionId: string; inventoryPublicId: string; quantity: number }[];
  reservationTransfer?: { reservationId: string; originalExpiresAt: string; transferredAt: string } | null;
  note: string | null;
};
export class JwStoneSaleError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export function initialJwStoneSale(): JwStoneSaleState {
  return { revision: 0, status: "pending_review", quote: null, attempt: null, allocations: [], note: null };
}
export function assertJwStoneQuoteTotal(quote: JwStoneFinalQuote): void { jwStoneFinalQuoteSchema.parse(quote); }
/** Review is latched: provider replays cannot undo a stock/payment discrepancy. */
export function applyJwStonePaymentOutcome(state: JwStoneSaleState, outcome: JwStonePaymentOutcome): JwStoneSaleState {
  if (!state.attempt || !state.quote) throw new JwStoneSaleError(409, "payment_missing", "There is no payment to reconcile.");
  if (state.status === "needs_review") return state;
  if (state.status === "paid" && outcome !== "needs_review") return state;
  if (state.status === "processing" && outcome === "open") return state;
  if (["payment_failed", "payment_expired"].includes(state.status)) {
    if (outcome === "paid" || outcome === "processing" || outcome === "needs_review") return { ...state, status: "needs_review", attempt: { ...state.attempt, outcome: "needs_review" }, note: "Payment changed after stock was released. JW Stone must reconcile this order before fulfillment." };
    return state;
  }
  if ((outcome === "paid" || outcome === "processing") && state.allocations.length === 0) {
    return { ...state, status: "needs_review", attempt: { ...state.attempt, outcome: "needs_review" }, note: "Payment has no matching stock allocation. JW Stone must reconcile this order before fulfillment." };
  }
  const status = { open: "checkout", processing: "processing", paid: "paid", failed: "payment_failed", expired: "payment_expired", needs_review: "needs_review" } as const;
  return { ...state, status: status[outcome], attempt: { ...state.attempt, outcome }, note: outcome === "processing" ? "Payment is processing. This is not a paid receipt." : outcome === "needs_review" ? "Payment requires review. Do not submit another payment or fulfill this order yet." : null };
}
