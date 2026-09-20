import { jwStonePriceKey } from "./jwStoneMemberPricing";

/** Seven eligible slabs form a bundle; cross-material pooling is not approved. */
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

/** Quantity alone cannot authorize combining different or unidentified materials. */
export function jwStoneBundleNeedsMaterialReview(lines: readonly JwStoneBundleCandidate[]): boolean {
  const materials = new Set<string>();
  for (const line of lines) {
    if (line.status !== "ready" || !line.bundlePricing || !isJwStoneBundleEligible(line.bundlePricing))
      continue;
    const key = jwStonePriceKey(line.materialName);
    if (!key) return true;
    materials.add(key);
  }
  return materials.size > 1;
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
/** Use the source rate, not a flat percent. Cart-wide pooling requires confirmed
 * same-material identity; published per-stock quantity tiers remain independent. */
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
