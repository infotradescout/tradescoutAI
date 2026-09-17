import { z } from "zod";
import { jwStoneCartReviewRequestSchema, type JwStoneCartReviewRequest } from "./jwStoneCart";

const cents = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
/** An offer proposes a material total. It cannot authorize payment or reserve stock. */
export const jwStoneOfferInputSchema = z.object({
  scope: z.enum(["stone", "cart"]),
  selection: jwStoneCartReviewRequestSchema,
  offeredTotalCents: cents,
  expectedSubtotalCents: cents,
  termsAcknowledged: z.literal(true),
}).strict().superRefine((value, context) => {
  if (value.scope === "stone" && value.selection.lines.length !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selection", "lines"], message: "Choose one stock selection for a stone offer." });
  }
});
export type JwStoneOfferInput = z.infer<typeof jwStoneOfferInputSchema>;
export type JwStoneOfferContext = { viewerId: string } & (
  | { scope: "stone"; stoneName: string; inventoryPublicId?: string }
  | { scope: "cart"; selection: JwStoneCartReviewRequest; displayedSubtotalCents: number }
);

/** Parse USD in integer cents; reject exponent notation and rounding. */
export function parseJwStoneOfferDollars(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || normalized.length > 18) return null;
  const [dollars, fraction = ""] = normalized.split(".");
  const whole = Number(dollars);
  if (!Number.isSafeInteger(whole) || whole > Math.floor(Number.MAX_SAFE_INTEGER / 100)) return null;
  const amount = whole * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
export const JW_STONE_OFFER_TERMS = "This is a material-price offer, not an order or reservation. Tax and delivery are separate. No payment is accepted until JW Stone confirms the offer and final payable total.";
