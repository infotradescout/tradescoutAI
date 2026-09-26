import { requireJwStoneEnhancements } from "./jwStoneFeatureAccess";
import {
  jwStoneOfferInputSchema,
  JW_STONE_OFFER_TERMS,
  type JwStoneOfferInput,
} from "@shared/jwStoneOffer";
import { parseJwStoneCartReview } from "@shared/jwStoneCart";
import { resolveJwStonePricingAccess } from "./jwStonePricingAccess";
import { reviewJwStoneMemberCart } from "../routes/jw-stone-member-pricing";

export class JwStoneOfferError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}
/** Intake only. A contact-request acceptance is NOT commercial offer confirmation. */
export async function reviewJwStoneOffer(args: {
  profileSlug: string;
  viewerId: string;
  user: unknown;
  input: JwStoneOfferInput;
}) {
  await requireJwStoneEnhancements();

  if (args.profileSlug !== "jw-stone")
    throw new JwStoneOfferError(
      400,
      "OFFER_PROFILE_INVALID",
      "Stone offers are available only for JW Stone."
    );
  if (!args.viewerId)
    throw new JwStoneOfferError(
      401,
      "OFFER_SIGN_IN_REQUIRED",
      "Sign in with your JW Stone business membership to make an offer."
    );
  const input = jwStoneOfferInputSchema.parse(args.input);
  const access = await resolveJwStonePricingAccess({ userId: args.viewerId, user: args.user });
  if (access !== "member")
    throw new JwStoneOfferError(
      403,
      "OFFER_MEMBERSHIP_REQUIRED",
      "An active JW Stone business membership is required to make an offer."
    );
  const review = parseJwStoneCartReview(
    await reviewJwStoneMemberCart(args.viewerId, input.selection),
    args.viewerId,
    input.selection
  );
  if (!review.materialReady || review.subtotalCents == null)
    throw new JwStoneOfferError(
      409,
      "OFFER_STOCK_CHANGED",
      "Stock or pricing changed. Review your selections before sending an offer."
    );
  if (review.subtotalCents !== input.expectedSubtotalCents)
    throw new JwStoneOfferError(
      409,
      "OFFER_PRICE_CHANGED",
      "The listed total changed. Review the latest total before sending your offer."
    );
  return {
    version: 1 as const,
    scope: input.scope,
    currency: "USD" as const,
    status: "pending_review" as const,
    paymentAllowed: false as const,
    inventoryReserved: false as const,
    confirmedAt: null,
    confirmedByUserId: null,
    finalPayableTotalCents: null,
    offeredTotalCents: input.offeredTotalCents,
    listedSubtotalCents: review.subtotalCents,
    reviewedAt: review.reviewedAt,
    fulfillment: review.fulfillment,
    termsAcknowledgedAt: new Date().toISOString(),
    terms: JW_STONE_OFFER_TERMS,
    bundleApplied: review.bundle?.unlocked ?? false,
    lines: review.lines.flatMap((line) =>
      line.status === "ready"
        ? [
            {
              inventoryPublicId: line.inventoryPublicId,
              materialName: line.materialName,
              materialSlug: line.materialSlug,
              quantity: line.requestedQuantity,
              dimensions: line.dimensions,
              unitRateCents: line.unitRateCents,
              lineTotalCents: line.lineTotalCents,
              pricingTier: line.pricingTier,
            },
          ]
        : []
    ),
  };
}
export type JwStonePendingOffer = Awaited<ReturnType<typeof reviewJwStoneOffer>>;
export function summarizeJwStoneOffer(offer: JwStonePendingOffer): string {
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  return [
    "JW Stone offer — pending review",
    "Offered material total: " + money(offer.offeredTotalCents),
    "Listed material subtotal: " + money(offer.listedSubtotalCents),
    ...offer.lines.map(
      (line) =>
        line.quantity + " slab(s): " + line.materialName + " — stock " + line.inventoryPublicId
    ),
    offer.fulfillment.method === "delivery"
      ? "Delivery requested to " + offer.fulfillment.postalCode + "; freight to be confirmed."
      : "Pickup requested; timing to be confirmed.",
    JW_STONE_OFFER_TERMS,
  ].join("\n");
}
