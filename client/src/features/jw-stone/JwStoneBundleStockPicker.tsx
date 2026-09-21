import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { JwStoneCartReview } from "@shared/jwStoneCart";
import { apiRequest } from "@/lib/queryClient";
import { JwStoneMemberPriceDisplay, useJwStoneMemberPrice } from "./JwStoneMemberPricing";
import { parseJwStoneBundleStock, searchJwStoneBundleStock, type JwStoneBundleStock } from "./bundleStock";

function StockCard({ item, selected, checking }: { item: JwStoneBundleStock; selected: number; checking: boolean }) {
  const price = useJwStoneMemberPrice(item.materialName);
  const memberPrice = price?.access === "member" ? price : null;
  const countsTowardBundle = Boolean(memberPrice && memberPrice.bundlePriceCents < memberPrice.slabPriceCents && (memberPrice.bundleMinSlabs ?? 7) <= 7);
  return (
    <article className="min-w-0 border border-[var(--jw-border)] p-3" data-testid="jw-bundle-stock-option" data-stock-id={item.id}>
      <div className="flex min-w-0 items-start gap-3">
        {item.imageUrls[0] ? <img src={item.imageUrls[0]} alt={item.materialName} loading="lazy" className="h-20 w-20 shrink-0 object-contain" /> : null}
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold">{item.materialName}</h3>
          <p className="mt-1 text-xs text-[var(--jw-muted)]">{item.dimensions.length} × {item.dimensions.height}{item.dimensions.thickness ? ` × ${item.dimensions.thickness}` : ""} {item.dimensions.unit}</p>
          <p className="mt-1 text-xs text-[var(--jw-muted)]">{item.quantity} listed {item.quantity === 1 ? "slab" : "slabs"} · Lot {item.id.slice(-8)}</p>
          {item.finishQuantities.length ? <p className="mt-1 text-xs">{item.finishQuantities.map((finish) => finish.finish).join(" / ")}</p> : null}
        </div>
      </div>
      {selected > 0 ? <p role="status" className="mt-2 text-xs font-semibold">{selected} selected from this lot</p> : null}
      {memberPrice ? (
        <>
          <p className="mt-2 text-xs">{countsTowardBundle ? "Counts toward your mixed-stone bundle" : "This lot keeps its listed quantity rates; it does not count toward the seven-slab bundle."}</p>
          <fieldset disabled={checking || selected >= Math.min(999, item.quantity)} className="min-w-0 border-0 p-0 disabled:opacity-50" aria-label={`Add ${item.materialName} to your bundle`}>
            <JwStoneMemberPriceDisplay stoneName={item.materialName} slabDimensions={item.dimensions} inventoryPublicId={item.id} />
          </fieldset>
          {selected >= Math.min(999, item.quantity) ? <p className="mt-2 text-xs">All listed slabs from this lot are selected. Adjust quantities in your cart below.</p> : null}
        </>
      ) : <p className="mt-2 text-xs">A current business-member price is needed before this lot can be added. Reopen the cart to refresh your pricing access.</p>}
    </article>
  );
}

/** Uses the same member-pricing context and add-to-cart action as the catalog. No prices are persisted. */
export default function JwStoneBundleStockPicker({ review, checking }: { review?: JwStoneCartReview; checking: boolean }) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(7);
  const inventory = useQuery({
    queryKey: ["jw-stone", "bundle-stock-picker"],
    queryFn: async ({ signal }) => parseJwStoneBundleStock(await apiRequest("/api/u/jw-stone/stone-inventory/current", { signal })),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: 60_000,
  });
  const matches = useMemo(() => searchJwStoneBundleStock(inventory.data ?? [], search), [inventory.data, search]);
  const visible = matches.slice(0, limit);
  return (
    <div className="mt-4 min-w-0 space-y-3" data-testid="jw-bundle-stock-picker">
      <p className="text-xs leading-5">Choose any seven eligible slabs—even one each of seven different stones. Add them here without leaving your cart. Each stone keeps its own bundle rate.</p>
      <label className="block text-xs font-semibold">
        Find stone for your bundle
        <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setLimit(7); }} className="mt-1 min-h-11 w-full min-w-0 border border-[var(--jw-border)] bg-[var(--jw-surface)] px-3 text-sm" placeholder="Stone name, material, or finish" />
      </label>
      {inventory.isPending ? <p role="status" className="text-sm">Loading published slab lots…</p> : inventory.isError ? (
        <div role="alert" className="text-sm">
          <p>The slab list could not be refreshed. Your cart selections are still saved.</p>
          <button type="button" onClick={() => void inventory.refetch()} className="mt-2 min-h-11 px-3 underline">Retry slab list</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p role="status">{matches.length ? `Showing ${visible.length} of ${matches.length} matching slab lots` : search ? "No matching slab lots. Try another stone name or clear the search." : "No measured slab lots are currently listed. Browse the collection or contact JW Stone."}</p>
            <button type="button" disabled={inventory.isFetching} onClick={() => void inventory.refetch()} className="min-h-11 px-2 underline disabled:opacity-50">{inventory.isFetching ? "Refreshing…" : "Refresh slab list"}</button>
          </div>
          {visible.map((item) => <StockCard key={item.id} item={item} selected={review?.lines.find((line) => line.inventoryPublicId === item.id)?.requestedQuantity ?? 0} checking={checking || inventory.isFetching} />)}
          {matches.length > limit ? <button type="button" onClick={() => setLimit((current) => current + 7)} className="min-h-11 w-full border border-[var(--jw-border)] px-3 text-sm">Show more slab lots</button> : null}
        </>
      )}
      <p className="text-xs leading-5 text-[var(--jw-muted)]">Listed quantities are not a reservation. Your cart rechecks current availability, exact slab totals, and bundle eligibility after each change.</p>
    </div>
  );
}
