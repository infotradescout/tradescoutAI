import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest, ApiError } from "@/lib/queryClient";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import { jwStoneCartBatch, jwStoneCartInquiry, type JwStoneCartLine, type JwStoneCartReview } from "@shared/jwStoneCart";
import type { PublicStoneInventoryItem } from "@shared/stoneInventory";
import { createJwStoneCartStore } from "./jwStoneCartStore";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";

type CartContext = { enabled: boolean; add: (line: Omit<JwStoneCartLine, "quantity">) => boolean };
const EMPTY: CartContext = { enabled: false, add: () => false };
const Context = createContext<CartContext>(EMPTY);
export const useJwStoneCart = () => useContext(Context);
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
const STATUS = { ready: "", unavailable: "This lot is no longer available. Remove it or ask JW Stone about alternatives.", insufficient_quantity: "The requested quantity exceeds unreserved stock.", price_unavailable: "This lot needs a price from JW Stone.", dimensions_required: "Exact slab dimensions are needed to calculate this price.", unsupported_unit: "This item cannot be ordered as a slab quantity." };

export function JwStoneCartProvider({ children, viewerId }: { children: ReactNode; viewerId: string | null }) {
  return viewerId ? <CartSession key={viewerId} viewerId={viewerId}>{children}</CartSession> : <Context.Provider value={EMPTY}>{children}</Context.Provider>;
}
function CartSession({ children, viewerId }: { children: ReactNode; viewerId: string }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(0);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const store = useMemo(() => {
    let storage: Storage | null = null;
    try { if (typeof window !== "undefined") storage = window.localStorage; } catch { /* Memory-only cart. */ }
    return createJwStoneCartStore(storage, viewerId);
  }, [viewerId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const batch = useMemo(() => jwStoneCartBatch(snapshot.lines, page), [snapshot.lines, page]);
  useEffect(() => {
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === store.key || event.key === store.legacyKey) store.refresh(); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [store]);
  const access = useQuery<{ viewerId: string; allowed: boolean }>({ queryKey: ["jw-stone", "cart-access", viewerId], queryFn: () => apiRequest("GET", "/api/u/jw-stone/member-pricing/cart-access"), retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: "always", refetchInterval: 30000 });
  const member = access.data?.viewerId === viewerId && access.data.allowed && !access.isError;
  const lots = useMemo(() => batch.lines.filter(line => line.kind === "lot").map(line => ({ inventoryPublicId: line.id, quantity: line.quantity })), [batch]);
  const signature = JSON.stringify(lots);
  const review = useQuery<JwStoneCartReview>({
    queryKey: ["jw-stone", "cart-review", viewerId, signature], enabled: Boolean(member && open && lots.length), retry: false, gcTime: 0, staleTime: 0, refetchInterval: open ? 30000 : false, refetchOnWindowFocus: "always",
    queryFn: async ({ signal }) => {
      const result = await apiRequest("/api/u/jw-stone/member-pricing/cart-review", { method: "POST", body: { lines: lots }, signal });
      if (result?.profileSlug !== "jw-stone" || result.viewerId !== viewerId || result.currency !== "USD" || !Array.isArray(result.lines) || JSON.stringify(result.lines.map((line: any) => ({ inventoryPublicId: line.inventoryPublicId, quantity: line.requestedQuantity }))) !== signature) throw new Error("The returned review does not match this cart. Try again.");
      return result;
    },
  });
  const reviewDenied = review.error instanceof ApiError && [401, 403].includes(review.error.status || 0);
  const enabled = Boolean(member && (!reviewDenied || access.dataUpdatedAt > review.errorUpdatedAt));
  useEffect(() => { if (!enabled) { setOpen(false); setRequestMessage(null); } }, [enabled]);
  const fresh = enabled && !review.isFetching && !review.isError && review.data?.viewerId === viewerId ? review.data : null;
  const reviewedById = new Map(fresh?.lines.map(line => [line.inventoryPublicId, line]) ?? []);
  function mutate(action: () => void): boolean {
    if (!enabled) return false;
    try { action(); setNotice(""); return true; }
    catch (error) { setNotice(error instanceof Error ? error.message : "Cart could not be updated."); return false; }
  }
  const value: CartContext = { enabled, add: line => {
    if (!enabled) return false;
    const added = mutate(() => store.add(line));
    if (added) {
      const index = store.getSnapshot().lines.findIndex(item => item.id === line.id);
      setPage(Math.floor(Math.max(0, index) / 50));
    }
    setOpen(true);
    return added;
  } };
  const count = snapshot.lines.reduce((sum, line) => sum + line.quantity, 0);
  const allLots = batch.lines.length > 0 && batch.lines.every(line => line.kind === "lot");
  function ask() {
    if (!enabled || !batch.lines.length) return;
    try { setRequestMessage(jwStoneCartInquiry(batch.lines)); setOpen(false); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Choose a cart batch first."); }
  }
  return <Context.Provider value={value}>
    {children}
    {enabled ? <>
      <button type="button" style={JW_STONE_BRAND_STYLE} data-testid="jw-stone-member-cart-button" onClick={() => setOpen(true)} aria-label={`Open JW Stone cart, ${count} slabs requested`} className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex min-h-12 items-center gap-2 border border-[var(--jw-border)] bg-[var(--jw-ink)] px-4 py-2 text-sm font-semibold text-white shadow-lg"><ShoppingCart className="h-4 w-4" />Cart ({count})</button>
      <Sheet open={open} onOpenChange={setOpen}><SheetContent side="right" style={JW_STONE_BRAND_STYLE} data-testid="jw-stone-member-cart" className={`flex h-full w-full flex-col p-0 sm:max-w-lg ${jw.page}`}>
        <SheetHeader className="border-b border-[var(--jw-border)] px-5 py-5 text-left"><SheetTitle className="text-[var(--jw-ink)]">JW Stone cart</SheetTitle><SheetDescription>Choose slabs, review current lot prices, and ask JW Stone to confirm pickup or delivery. Adding a lot does not reserve it.</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!snapshot.persisted ? <p role="status" className="mb-4 text-sm text-[var(--jw-ink)]">Browser storage could not be updated. These cart changes last for this visit only; unreadable saved data is not overwritten.</p> : null}
          {notice ? <p role="alert" className="mb-4 text-sm text-red-700">{notice}</p> : null}
          {batch.pages > 1 ? <nav aria-label="Saved cart batches" className="mb-4 border border-[var(--jw-border)] p-3 text-sm">
            <p role="status">All {snapshot.lines.length} saved selections are preserved. Review and request one batch of up to 50 at a time.</p>
            <p className="mt-2 font-semibold">Selections {batch.start + 1}–{batch.start + batch.lines.length} of {snapshot.lines.length}</p>
            <div className="mt-2 flex justify-between gap-3"><button type="button" disabled={batch.page === 0} onClick={() => setPage(batch.page - 1)} className="min-h-11 px-3 disabled:opacity-40">Previous batch</button><button type="button" disabled={batch.page + 1 === batch.pages} onClick={() => setPage(batch.page + 1)} className="min-h-11 px-3 disabled:opacity-40">Next batch</button></div>
          </nav> : null}
          {!snapshot.lines.length ? <p className="py-12 text-center text-[var(--jw-muted)]">Your cart is empty. Add an inventory lot or a catalog selection.</p> : <ul className="space-y-4">{batch.lines.map(line => {
            const checked = reviewedById.get(line.id);
            return <li key={line.id} className="border border-[var(--jw-border)] bg-[var(--jw-bg)] p-4 text-[var(--jw-ink)]">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{checked?.materialName || line.stoneName}</h3><p className="mt-1 break-all text-xs text-[var(--jw-muted)]">{line.kind === "lot" ? `Lot ${line.id}` : "Catalog selection — choose an actual lot before an order can be priced."}</p></div><button type="button" aria-label={`Remove ${line.stoneName} from cart`} onClick={() => mutate(() => store.setQuantity(line.id, 0))} className="min-h-11 min-w-11"><Trash2 className="mx-auto h-4 w-4" /></button></div>
              {checked?.status === "ready" ? <p className="mt-3 text-sm">{money(checked.unitRateCents!)} / {checked.priceUnit === "slab" ? "slab" : "sq. ft."}{checked.pricingTier === "bundle" ? " · Bundle rate" : ""}<strong className="mt-1 block">{money(checked.lineTotalCents!)}</strong></p> : checked ? <p className="mt-3 text-sm" role="status">{STATUS[checked.status]}{checked.availableQuantity !== undefined ? ` Available: ${checked.availableQuantity} slabs.` : ""}</p> : line.kind === "lot" ? <p className="mt-3 text-sm text-[var(--jw-muted)]">{review.isFetching ? "Checking current price and stock…" : "Review this lot’s current price and stock."}</p> : null}
              <div className="mt-3 flex items-center gap-2"><button type="button" aria-label={`Decrease ${line.stoneName} quantity`} onClick={() => mutate(() => store.setQuantity(line.id, line.quantity - 1))} className="min-h-11 min-w-11 border border-[var(--jw-border)]"><Minus className="mx-auto h-4 w-4" /></button><span aria-label={`${line.stoneName} requested quantity`} className="min-w-10 text-center">{line.quantity}</span><button type="button" disabled={line.quantity >= 999} aria-label={`Increase ${line.stoneName} quantity`} onClick={() => mutate(() => store.setQuantity(line.id, line.quantity + 1))} className="min-h-11 min-w-11 border border-[var(--jw-border)] disabled:opacity-40"><Plus className="mx-auto h-4 w-4" /></button><span className="text-xs text-[var(--jw-muted)]">slabs requested</span></div>
            </li>;
          })}</ul>}
        </div>
        <div className="max-h-[50dvh] overflow-y-auto border-t border-[var(--jw-border)] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 text-[var(--jw-ink)]">
          {review.isError ? <p role="alert" className="mb-3 text-sm">Current prices could not be confirmed. No saved price estimate is being substituted.</p> : null}
          {allLots && fresh?.readyForRequest && fresh.subtotalCents !== null ? <p className="flex justify-between gap-3 text-sm"><span>{batch.pages > 1 ? "Reviewed batch material subtotal" : "Reviewed material subtotal"}</span><strong>{money(fresh.subtotalCents)}</strong></p> : null}
          <p className="mt-2 text-xs text-[var(--jw-muted)]">Tax, delivery, timing, and final availability are confirmed by JW Stone. This is not a completed purchase.{batch.pages > 1 ? " Other batches are not included in this review or request." : ""}</p>
          {lots.length ? <button type="button" disabled={review.isFetching} onClick={() => void review.refetch()} className={`mt-3 min-h-11 w-full px-4 text-sm ${jw.ghostOnLight}`}>{review.isFetching ? "Reviewing…" : "Review current prices & availability"}</button> : null}
          <button type="button" disabled={!batch.lines.length} onClick={ask} className={`mt-3 min-h-12 w-full px-4 text-sm disabled:opacity-40 ${jw.accentCta}`}>{batch.pages > 1 ? `Ask JW Stone about batch ${batch.page + 1}` : "Ask JW Stone about this cart"}</button>
          <div className="mt-2 flex gap-3"><button type="button" onClick={() => setOpen(false)} className="min-h-11 flex-1 text-sm">Continue shopping</button>{snapshot.lines.length ? <button type="button" onClick={() => { if (window.confirm(`Clear all ${snapshot.lines.length} selections from this account’s JW Stone cart?`)) mutate(() => store.clear()); }} className="min-h-11 flex-1 text-sm">Clear entire cart</button> : null}</div>
        </div>
      </SheetContent></Sheet>
      {requestMessage !== null ? <div style={JW_STONE_BRAND_STYLE}><ExpressDirectConnectPanel open={true} onClose={() => setRequestMessage(null)} profileSlug="jw-stone" businessName="JW Stone" hasViewerSession={true} allowCall={false} stayInProfile={true} requestMode="materials" initialView="request" initialRequestType="request_material" initialMessage={requestMessage} /></div> : null}
    </> : null}
  </Context.Provider>;
}
export function JwStoneLotCartButton({ item, onOpenCart }: { item: PublicStoneInventoryItem; onOpenCart?: () => void }) {
  const cart = useJwStoneCart();
  if (!cart.enabled) return null;
  return <button type="button" onClick={() => { cart.add({ id: item.id, kind: "lot", stoneName: item.materialName }); onOpenCart?.(); }} className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm ${jw.ghostOnLight}`}><ShoppingCart className="h-4 w-4" />Add this lot to cart</button>;
}
