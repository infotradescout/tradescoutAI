import { jwStoneOfferInputSchema, JW_STONE_OFFER_TERMS, type JwStoneOfferInput } from "@shared/jwStoneOffer";
import { parseJwStoneCartReview } from "@shared/jwStoneCart";
import { resolveJwStonePricingAccess } from "./jwStonePricingAccess";
import { reviewJwStoneMemberCart } from "../routes/jw-stone-member-pricing";
import {
  TradeScoutStoneOfferError,
  reviewTradeScoutStoneOffer,
} from "./tradeScoutStoneOfferReview";

/**
 * JW Stone supplier adapter for the TradeScout-owned offer product.
 *
 * JW Stone retains its membership, pricing and inventory authority. TradeScout
 * owns the offer workflow/orchestration that consumes those supplier facts.
 */
export class JwStoneOfferError extends TradeScoutStoneOfferError {}

export async function reviewJwStoneOffer(args: {
  profileSlug: string; viewerId: string; user: unknown; input: JwStoneOfferInput;
}) {
  if (args.profileSlug !== "jw-stone") {
    throw new JwStoneOfferError(400, "OFFER_PROFILE_INVALID", "Stone offers are unavailable for this supplier.");
  }
  const input = jwStoneOfferInputSchema.parse(args.input);
  try {
    return await reviewTradeScoutStoneOffer({
      supplierSlug: "jw-stone",
      supplierName: "JW Stone",
      viewerId: args.viewerId,
      input,
      terms: JW_STONE_OFFER_TERMS,
      requireOfferAccess: async () =>
        (await resolveJwStonePricingAccess({ userId: args.viewerId, user: args.user })) === "member",
      reviewSelection: async (selection) =>
        parseJwStoneCartReview(
          await reviewJwStoneMemberCart(args.viewerId, selection),
          args.viewerId,
          selection
        ),
    });
  } catch (error) {
    if (error instanceof TradeScoutStoneOfferError) {
      const compatibilityCode =
        error.code === "OFFER_ACCESS_REQUIRED" ? "OFFER_MEMBERSHIP_REQUIRED" : error.code;
      const compatibilityMessage =
        error.code === "OFFER_ACCESS_REQUIRED"
          ? "An active JW Stone business membership is required to make an offer."
          : error.message;
      throw new JwStoneOfferError(error.status, compatibilityCode, compatibilityMessage);
    }
    throw error;
  }
}

export type JwStonePendingOffer = Awaited<ReturnType<typeof reviewJwStoneOffer>>;

export function summarizeJwStoneOffer(offer: JwStonePendingOffer): string {
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  return [
    "TradeScout offer for JW Stone inventory — pending review",
    "Offered material total: " + money(offer.offeredTotalCents),
    "Listed material subtotal: " + money(offer.listedSubtotalCents),
    ...offer.lines.map((line) =>
      line.quantity + " slab(s): " + line.materialName + " — stock " + line.inventoryPublicId
    ),
    (offer.fulfillment as { method?: string; postalCode?: string }).method === "delivery"
      ? "Delivery requested to " +
        (offer.fulfillment as { postalCode?: string }).postalCode +
        "; freight to be confirmed."
      : "Pickup requested; timing to be confirmed.",
    JW_STONE_OFFER_TERMS,
  ].join("\n");
}
