import { useQuery } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import type { jwStoneReceiptMemberPrice } from "@shared/jwStoneReceiving";
import type { JwStoneReceiptPriceProps } from "./JwStoneArrivalPrice";

type Price = ReturnType<typeof jwStoneReceiptMemberPrice>;
const dollars = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export default function JwStoneReceiptPriceDetails({
  item,
  viewerId,
  fallback,
}: JwStoneReceiptPriceProps) {
  const query = useQuery<{ viewerId: string; prices: Price[] }>({
    queryKey: ["jw-stone", "arrival-prices", viewerId],
    enabled: Boolean(viewerId),
    queryFn: () => apiRequest("GET", "/api/u/jw-stone/receiving/prices"),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  if (query.isError)
    return (
      <div className="mt-4 text-sm">
        <p role="status">
          {query.error instanceof ApiError && query.error.status === 403
            ? "JW Stone business membership is required to view pricing."
            : "Pricing is temporarily unavailable."}
        </p>
        <button type="button" onClick={() => void query.refetch()} className="min-h-11 underline">
          Try again
        </button>
      </div>
    );
  if (query.isLoading || query.data?.viewerId !== viewerId) return null;
  const price = query.data.prices.find((entry) => entry.publicId === item.id);
  if (!price)
    return item.imageUrls.some((url) => url.includes("/jw-stone/receiving/")) ? (
      <p className="mt-4 text-sm">
        Review this lot in your cart for current pricing and availability.
      </p>
    ) : (
      fallback
    );
  const length = Number(item.dimensions?.length),
    height = Number(item.dimensions?.height);
  const scale =
    item.dimensions?.unit === "mm" ? 1 / 25.4 : item.dimensions?.unit === "in" ? 1 : null;
  const area = scale && length > 0 && height > 0 ? (length * scale * height * scale) / 144 : null;
  const slabTotal =
    price.unit === "slab"
      ? price.sellPriceCents
      : area
        ? Math.round(area * price.sellPriceCents)
        : null;
  return (
    <div className="mt-4 border-t border-[var(--jw-border)] pt-4 text-sm text-[var(--jw-ink)]">
      <p className="font-semibold">
        {dollars(price.sellPriceCents)} / {price.unit === "slab" ? "slab" : "sq. ft."}
      </p>
      {price.unit === "square_foot" && slabTotal !== null ? (
        <p>{dollars(slabTotal)} per slab at the listed dimensions</p>
      ) : null}
      {price.bundlePriceCents !== null && price.bundleMinSlabs !== null ? (
        <p className="mt-1">
          {dollars(price.bundlePriceCents)} / {price.unit === "slab" ? "slab" : "sq. ft."} for{" "}
          {price.bundleMinSlabs}+ slabs
        </p>
      ) : null}
    </div>
  );
}
