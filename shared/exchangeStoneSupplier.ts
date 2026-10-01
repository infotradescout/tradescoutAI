import { HONEY_ONYX_PUBLIC_REFERENCE } from "./exchangeStonePublicReference";
import { stoneInquiryMessage } from "./exchangeStoneBuyerFlow";

type StoneListing = {
  id?: unknown;
  title?: string;
  price?: unknown;
  specifications?: Record<string, unknown>;
};

/** Explicit operator correction: Honey Onyx is ISSA Build's product.
 * Supplier attribution does not change the signed marketplace operator, seller
 * account, pricing entitlement, stock or protected contact authority.
 */
export function stonePublicSupplier(listing: StoneListing) {
  return listing.id === HONEY_ONYX_PUBLIC_REFERENCE.listingId &&
    listing.specifications?.commerceChannel === "tradescout_stone_retail"
    ? {
        name: "ISSA Build",
        profilePath: "/issa-build/onyx",
        productPath: "/issa-build/onyx/inventory/honey-onyx",
      } as const
    : null;
}

export function stoneFabricatorPricingMessage(
  listing: { id?: string; title: string; price: unknown; specifications?: Record<string, unknown> }
): string | null {
  const supplier = stonePublicSupplier(listing);
  return supplier
    ? `Please confirm fabricator pricing for Honey Onyx from ${supplier.name}. ${stoneInquiryMessage(listing, "availability")}`
    : null;
}
