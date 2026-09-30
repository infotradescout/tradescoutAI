/** Public homeowner reference approved from the operator's source read on 2026-09-30.
 * Reference dimensions identify a pricing example, not an available physical slab.
 */
export const HONEY_ONYX_PUBLIC_REFERENCE = Object.freeze({
 listingId: "tradescout-stone-honey-onyx", rateUsdPerSqFt: 47.25, dimensionsInches: "121x65",
 sourceRoundedSlabTotalUsd: 2581,
});
type Listing = { id?: unknown; price?: unknown; specifications?: Record<string, unknown> };
export function stonePublicReferenceSizes(listing: Listing): unknown {
 const specs = listing.specifications || {};
 // Supplied data always wins, including invalid values which the price parser must reject.
 if (specs.referenceSizesInches != null && specs.referenceSizesInches !== "") return specs.referenceSizesInches;
 if (listing.id === HONEY_ONYX_PUBLIC_REFERENCE.listingId &&
     specs.commerceChannel === "tradescout_stone_retail" && specs.priceUnit === "sqft" &&
     (listing.price === 47.25 || listing.price === "47.25")) return HONEY_ONYX_PUBLIC_REFERENCE.dimensionsInches;
 return specs.referenceSizesInches;
}
