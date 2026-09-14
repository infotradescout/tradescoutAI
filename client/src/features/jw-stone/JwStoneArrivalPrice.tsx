import { JwStoneLoadingStatus } from "./JwStoneLoadingStatus";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { PublicStoneInventoryItem } from "@shared/stoneInventory";
import { JwStoneMemberPriceDisplay } from "./JwStoneMemberPricing";
import { JwStoneLotCartButton } from "./JwStoneCart";
import {
  createJwStoneComponentLoader,
  useJwStoneDeferredComponent,
} from "./deferredJwStoneComponent";

export type JwStoneReceiptPriceProps = {
  item: PublicStoneInventoryItem;
  viewerId: string;
  fallback: ReactNode;
};
const loadPrices = createJwStoneComponentLoader<JwStoneReceiptPriceProps>(() =>
  import("./JwStoneReceiptPriceDetails").then((module) => module.default)
);
function ReceiptPrice(props: JwStoneReceiptPriceProps) {
  const { Component: Prices, failed, retry } = useJwStoneDeferredComponent(loadPrices);
  if (Prices) return <Prices {...props} />;
  return (
    <div className="mt-4 text-sm">
      <JwStoneLoadingStatus subject="lot prices" failed={failed} retry={retry} />
    </div>
  );
}
export function JwStoneArrivalPrice({
  item,
  onCartOpen,
}: {
  item: PublicStoneInventoryItem;
  onCartOpen?: () => void;
}) {
  const { user } = useAuth();
  const viewerId = String(user?.id || "");
  const fallback = (
    <JwStoneMemberPriceDisplay
      stoneName={item.materialName}
      slabDimensions={item.dimensions}
      presentation="inventory"
      allowCatalogCart={false}
    />
  );
  return (
    <>
      {viewerId ? (
        <ReceiptPrice key={viewerId} item={item} viewerId={viewerId} fallback={fallback} />
      ) : (
        fallback
      )}
      <JwStoneLotCartButton item={item} onOpenCart={onCartOpen} />
    </>
  );
}
