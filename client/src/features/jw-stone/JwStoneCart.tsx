import { ShoppingCart } from "lucide-react";
import type { PublicStoneInventoryItem } from "@shared/stoneInventory";
import { jwStonePriceKey } from "@shared/jwStoneMemberPricing";
import { useJwStoneMemberCart } from "./JwStoneMemberPricing";
import { jw } from "./brand";

/** Received and catalog inventory use the same account cart and quote workflow. */
export function JwStoneLotCartButton({
  item,
  onOpenCart,
}: {
  item: PublicStoneInventoryItem;
  onOpenCart?: () => void;
}) {
  const cart = useJwStoneMemberCart();
  if (!cart.cartEnabled) return null;
  return (
    <button
      type="button"
      onClick={() => {
        cart.addToCart({
          id: `stock:${item.id}`,
          inventoryPublicId: item.id,
          stoneName: item.materialName,
          stoneKey: jwStonePriceKey(item.materialName),
        });
        onOpenCart?.();
      }}
      className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm ${jw.ghostOnLight}`}
    >
      <ShoppingCart className="h-4 w-4" />
      Add this lot to cart
    </button>
  );
}
