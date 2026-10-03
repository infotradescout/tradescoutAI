/**
 * TradeScout-owned offer orchestration.
 *
 * Supplier adapters provide membership/entitlement checks and an authoritative
 * cart review. This layer owns the reusable offer product semantics and does
 * not own supplier inventory, pricing data, discounts, or membership records.
 */
export class TradeScoutStoneOfferError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "TradeScoutStoneOfferError";
  }
}

export type TradeScoutStoneOfferLine = Readonly<{
  status: string;
  inventoryPublicId?: string;
  materialName?: string;
  materialSlug?: string;
  requestedQuantity?: number;
  dimensions?: unknown;
  unitRateCents?: number;
  lineTotalCents?: number;
  pricingTier?: unknown;
}>;

export type TradeScoutStoneCartReview = Readonly<{
  materialReady: boolean;
  subtotalCents: number | null;
  reviewedAt: string;
  fulfillment: { method: "pickup" } | { method: "delivery"; postalCode: string };
  bundle?: { unlocked?: boolean } | null;
  lines: readonly TradeScoutStoneOfferLine[];
  [key: string]: unknown;
}>;

export async function reviewTradeScoutStoneOffer<TInput extends {
  scope: string;
  offeredTotalCents: number;
  expectedSubtotalCents: number;
  selection: unknown;
}>(args: {
  supplierSlug: string;
  supplierName: string;
  viewerId: string;
  input: TInput;
  requireOfferAccess: () => Promise<boolean>;
  reviewSelection: (selection: TInput["selection"]) => Promise<TradeScoutStoneCartReview>;
  terms: string;
}) {
  if (!args.supplierSlug.trim()) {
    throw new TradeScoutStoneOfferError(400, "OFFER_SUPPLIER_INVALID", "Choose a valid stone supplier.");
  }
  if (!args.viewerId) {
    throw new TradeScoutStoneOfferError(401, "OFFER_SIGN_IN_REQUIRED", `Sign in to make an offer on ${args.supplierName} inventory.`);
  }
  if (!(await args.requireOfferAccess())) {
    throw new TradeScoutStoneOfferError(403, "OFFER_ACCESS_REQUIRED", `Your account does not have offer access for ${args.supplierName}.`);
  }

  const review = await args.reviewSelection(args.input.selection);
  if (!review.materialReady || review.subtotalCents == null) {
    throw new TradeScoutStoneOfferError(409, "OFFER_STOCK_CHANGED", "Stock or pricing changed. Review your selections before sending an offer.");
  }
  if (review.subtotalCents !== args.input.expectedSubtotalCents) {
    throw new TradeScoutStoneOfferError(409, "OFFER_PRICE_CHANGED", "The listed total changed. Review the latest total before sending your offer.");
  }

  return {
    version: 1 as const,
    supplierSlug: args.supplierSlug,
    supplierName: args.supplierName,
    scope: args.input.scope,
    currency: "USD" as const,
    status: "pending_review" as const,
    paymentAllowed: false as const,
    inventoryReserved: false as const,
    confirmedAt: null,
    confirmedByUserId: null,
    finalPayableTotalCents: null,
    offeredTotalCents: args.input.offeredTotalCents,
    listedSubtotalCents: review.subtotalCents,
    reviewedAt: review.reviewedAt,
    fulfillment: review.fulfillment,
    termsAcknowledgedAt: new Date().toISOString(),
    terms: args.terms,
    bundleApplied: review.bundle?.unlocked ?? false,
    lines: review.lines.flatMap((line) => line.status === "ready" ? [{
      inventoryPublicId: line.inventoryPublicId,
      materialName: line.materialName,
      materialSlug: line.materialSlug,
      quantity: line.requestedQuantity,
      dimensions: line.dimensions,
      unitRateCents: line.unitRateCents,
      lineTotalCents: line.lineTotalCents,
      pricingTier: line.pricingTier,
    }] : []),
  };
}
