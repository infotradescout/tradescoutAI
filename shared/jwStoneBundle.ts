import { jwStonePriceKey } from "./jwStoneMemberPricing";

/** Seven eligible slabs may span materials. Each material keeps its source rate and minimum. */
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
  materialName?: string;
  bundlePricing?: JwStoneBundlePricing;
}>;
/** Higher source minimums and non-discounted materials do not qualify for pooling. */
export function isJwStoneBundleEligible(price: JwStoneBundlePricing): boolean {
  return price.minimumSlabs <= JW_STONE_BUNDLE_SLABS && price.bundleRateCents < price.slabRateCents;
}

/** Different known materials may pool; unidentified material must still be checked. */
export function jwStoneBundleNeedsMaterialReview(lines: readonly JwStoneBundleCandidate[]): boolean {
  return lines.some(
    (line) =>
      line.status === "ready" &&
      line.bundlePricing &&
      isJwStoneBundleEligible(line.bundlePricing) &&
      !jwStonePriceKey(line.materialName)
  );
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
  const materialReviewRequired = jwStoneBundleNeedsMaterialReview(lines);
  return {
    requiredSlabs: JW_STONE_BUNDLE_SLABS,
    eligibleSlabs,
    remainingSlabs: Math.max(0, JW_STONE_BUNDLE_SLABS - eligibleSlabs),
    completeBundles: materialReviewRequired ? 0 : Math.floor(eligibleSlabs / JW_STONE_BUNDLE_SLABS),
    unlocked:
      !materialReviewRequired &&
      lines.length > 0 &&
      lines.every((line) => line.status === "ready") &&
      eligibleSlabs >= JW_STONE_BUNDLE_SLABS,
  };
}
/** Use each material's source rate, not a flat percent or blended rate.
 * Published per-stock quantity tiers remain independent of cart-wide eligibility. */
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
