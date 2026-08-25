import type { PublicStoneInventoryItem } from "@shared/stoneInventory";

type Props = {
  onAsk: (item: PublicStoneInventoryItem) => void;
  onStartRequest: () => void;
};

/**
 * Compatibility mount for the JW Stone merchandising slot.
 *
 * This position is reserved for explicitly identified New Arrivals. General
 * current inventory remains available to seller operations and BidRock, but
 * it must never be promoted here merely because it is confirmed and sale-ready.
 * Until JW Stone has real New Arrivals to publish, the public slot stays absent.
 */
export function CurrentInventorySection(_props: Props) {
  return null;
}
