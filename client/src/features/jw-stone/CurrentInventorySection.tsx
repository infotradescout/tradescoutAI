import type { PublicStoneInventoryItem } from "@shared/stoneInventory";

type Props = {
  onAsk: (item: PublicStoneInventoryItem) => void;
  onStartRequest: () => void;
};

/**
 * Compatibility mount for the JW Stone merchandising slot.
 *
 * This position is reserved for explicitly identified New Arrivals. General
 * current inventory includes only physical lots explicitly marked sale-ready,
 * but it remains seller and BidRock operational truth rather than public
 * New Arrivals merchandising. The Material Library does not claim that a
 * physical item is on hand. Until JW Stone has real New Arrivals to publish,
 * the public slot stays absent.
 */
export function CurrentInventorySection(_props: Props) {
  return null;
}
