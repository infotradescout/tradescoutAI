/** Seven eligible slabs form a bundle. Mixed-material eligibility in this draft awaits owner approval. */
export const JW_STONE_BUNDLE_SLABS = 7 as const;
export type JwStoneBundlePricing = Readonly<{
  slabRateCents: number;
  bundleRateCents: number;
  minimumSlabs: number;
  regularOneSlabCents: number;
  bundleOneSlabCents: number;
}>;
export type JwStoneBundleCandidate = Readonly<{
  status: string;
  requestedQuantity: number;
  bundlePricing?: JwStoneBundlePricing;
}>;
/** Higher source minimums and non-discounted materials do not qualify for mixing. */
export function isJwStoneBundleEligible(price: JwStoneBundlePricing): boolean {
  return price.minimumSlabs <= JW_STONE_BUNDLE_SLABS && price.bundleRateCents < price.slabRateCents;
}
export function getJwStoneBundleProgress(lines: readonly JwStoneBundleCandidate[]) {
  const eligibleSlabs = lines.reduce(
    (sum, line) =>
      sum +
      (line.status === "ready" && line.bundlePricing && isJwStoneBundleEligible(line.bundlePricing)
        ? line.requestedQuantity
        : 0),
    0
  );
  return {
    requiredSlabs: JW_STONE_BUNDLE_SLABS,
    eligibleSlabs,
    remainingSlabs: Math.max(0, JW_STONE_BUNDLE_SLABS - eligibleSlabs),
    completeBundles: Math.floor(eligibleSlabs / JW_STONE_BUNDLE_SLABS),
    unlocked:
      lines.length > 0 &&
      lines.every((line) => line.status === "ready") &&
      eligibleSlabs >= JW_STONE_BUNDLE_SLABS,
  };
}
/** Use each material's real rate for every eligible slab at 7+, not a flat percent.
 * Preserve better per-stock quantity tiers; never raise a price as a discount. */
export function priceJwStoneBundleLine(
  price: JwStoneBundlePricing,
  quantity: number,
  unlocked: boolean
) {
  const cents = [
    price.slabRateCents,
    price.bundleRateCents,
    price.regularOneSlabCents,
    price.bundleOneSlabCents,
  ];
  if (
    !cents.every((value) => Number.isSafeInteger(value) && value > 0) ||
    !Number.isInteger(price.minimumSlabs) ||
    price.minimumSlabs < 2 ||
    price.minimumSlabs > 999 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 999
  )
    throw new Error("Invalid bundle pricing inputs");
  const discounted =
    price.bundleRateCents < price.slabRateCents &&
    (quantity >= price.minimumSlabs || (unlocked && isJwStoneBundleEligible(price)));
  const oneSlabTotalCents = discounted ? price.bundleOneSlabCents : price.regularOneSlabCents;
  const lineTotalCents = oneSlabTotalCents * quantity;
  if (
    !Number.isSafeInteger(lineTotalCents) ||
    !Number.isSafeInteger(price.regularOneSlabCents * quantity)
  )
    throw new Error("Cart amount exceeds supported precision");
  return {
    pricingTier: discounted ? ("bundle" as const) : ("slab" as const),
    unitRateCents: discounted ? price.bundleRateCents : price.slabRateCents,
    oneSlabTotalCents,
    lineTotalCents,
  };
}
