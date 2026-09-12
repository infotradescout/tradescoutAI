import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, ApiError } from "@/lib/queryClient";
import type { PublicStoneInventoryItem } from "@shared/stoneInventory";
import type { jwStoneReceiptMemberPrice } from "@shared/jwStoneReceiving";
import { JwStoneMemberPriceDisplay } from "./JwStoneMemberPricing";

type Price = ReturnType<typeof jwStoneReceiptMemberPrice>;
const dollars = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export function JwStoneArrivalPrice({ item }: { item: PublicStoneInventoryItem }) {
  const { user } = useAuth();
  const viewerId = String(user?.id || "");
  const query = useQuery<{ viewerId: string; prices: Price[] }>({ queryKey: ["jw-stone", "arrival-prices", viewerId], enabled: Boolean(viewerId), queryFn: () => apiRequest("GET", "/api/u/jw-stone/receiving/prices"), staleTime: 0, gcTime: 0, retry: false });
  const fallback = <JwStoneMemberPriceDisplay stoneName={item.materialName} slabDimensions={item.dimensions} presentation="inventory" />;
  if (!viewerId) return fallback;
  if (query.isError) return <p className="mt-4 text-sm">{query.error instanceof ApiError && query.error.status === 403 ? "JW Stone business membership is required to view pricing." : "Pricing is temporarily unavailable."}</p>;
  if (query.isLoading || query.data?.viewerId !== viewerId) return null;
  const price = query.data.prices.find(entry => entry.publicId === item.id);
  if (!price) return fallback;
  const length = Number(item.dimensions?.length), height = Number(item.dimensions?.height);
  const scale = item.dimensions?.unit === "mm" ? 1 / 25.4 : item.dimensions?.unit === "in" ? 1 : null;
  const area = scale && length > 0 && height > 0 ? length * scale * height * scale / 144 : null;
  const slabTotal = price.unit === "slab" ? price.sellPriceCents : area ? Math.round(area * price.sellPriceCents) : null;
  return <div className="mt-4 border-t border-[var(--jw-border)] pt-4 text-sm text-[var(--jw-ink)]"><p className="font-semibold">{dollars(price.sellPriceCents)} / {price.unit === "slab" ? "slab" : "sq. ft."}</p>{price.unit === "square_foot" && slabTotal !== null ? <p>{dollars(slabTotal)} per slab at the listed dimensions</p> : null}{price.bundlePriceCents !== null && price.bundleMinSlabs !== null ? <p className="mt-1">{dollars(price.bundlePriceCents)} / {price.unit === "slab" ? "slab" : "sq. ft."} for {price.bundleMinSlabs}+ slabs</p> : null}</div>;
}
