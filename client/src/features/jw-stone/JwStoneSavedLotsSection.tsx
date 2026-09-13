import { useQuery } from "@tanstack/react-query";
import { Trash2, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { PublicStoneInventoryResponse } from "@shared/stoneInventory";
import { type JwStoneSavedLot, jwStoneSavedLotStatus, jwStoneLotInquiry } from "./jwStoneSavedLotsStore";
import { JwStoneArrivalGallery } from "./JwStoneArrivalGallery";
import { JwStoneArrivalPrice } from "./JwStoneArrivalPrice";
import { jw } from "./brand";

export function JwStoneSavedLotsSection({ open, lots, onRemove, onAsk, onCartOpen }: {
  open: boolean; lots: readonly JwStoneSavedLot[]; onRemove: (id: string) => void; onAsk: (message: string) => void; onCartOpen: () => void;
}) {
  const inventory = useQuery<PublicStoneInventoryResponse>({
    queryKey: ["jw-stone", "saved-lot-inventory"],
    enabled: open && lots.length > 0,
    queryFn: async () => {
      const result = await apiRequest("GET", "/api/u/jw-stone/receiving/inventory");
      if (result?.profileSlug !== "jw-stone" || !Array.isArray(result.items)) throw new Error("Inventory response could not be verified.");
      return result;
    },
    retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: "always", refetchInterval: open ? 30000 : false,
  });
  // Never treat a failed/unfinished refresh as a missing or available lot.
  const current = !inventory.isError && !inventory.isFetching ? inventory.data?.items : undefined;
  const byId = new Map(current?.map(item => [item.id, item]) ?? []);
  const listedIds = current ? new Set(byId.keys()) : null;
  if (!lots.length) return null;
  return <section aria-labelledby="jw-saved-lots-heading" className="mb-6">
    <h3 id="jw-saved-lots-heading" className="font-editorial text-2xl text-[var(--jw-ink)]">Saved inventory lots ({lots.length})</h3>
    <p className={`mt-2 text-sm ${jw.muted}`}>Exact lot references. Saving does not reserve slabs. Prices remain limited to eligible JW Stone business members.</p>
    {inventory.isError ? <div role="status" className="mt-3 text-sm"><p>Inventory could not be refreshed. Your saved lots are still here; availability is unknown.</p><button type="button" onClick={() => void inventory.refetch()} className="min-h-11 underline">Retry inventory check</button></div> : null}
    <ul className="mt-4 space-y-5">{lots.map(lot => {
      const item = byId.get(lot.id);
      const status = jwStoneSavedLotStatus(lot.id, listedIds);
      return <li key={lot.id} className={`border p-3 ${jw.border}`}>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-semibold text-[var(--jw-ink)]">{item?.materialName || lot.stoneName}</h4><p className={`mt-1 break-all text-xs ${jw.muted}`}>{lot.id}</p></div><button type="button" aria-label={`Remove saved lot ${lot.stoneName}`} onClick={() => onRemove(lot.id)} className="min-h-11 min-w-11"><Trash2 className="mx-auto h-4 w-4" /></button></div>
        {status === "unknown" ? <p className={`mt-3 text-sm ${jw.muted}`}>{inventory.isFetching ? "Checking the current listing…" : "Availability has not been checked."}</p> : status === "not_listed" ? <p className="mt-3 text-sm">Not currently listed. Keep this reference or ask JW Stone about this lot and alternatives.</p> : item ? <>
          <p className={`my-3 text-sm ${jw.muted}`}>Currently listed. The cart rechecks price and unreserved quantity before a request.</p>
          <JwStoneArrivalGallery item={item} />
          <JwStoneArrivalPrice item={item} onCartOpen={onCartOpen} />
        </> : null}
        <button type="button" onClick={() => onAsk(jwStoneLotInquiry(lot))} className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm ${jw.accentCta}`}><MessageCircle className="h-4 w-4" />Ask about this exact lot</button>
      </li>;
    })}</ul>
  </section>;
}
