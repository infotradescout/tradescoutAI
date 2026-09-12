import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest, ApiError } from "@/lib/queryClient";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import { type JwStoneCartLine, type JwStoneCartReview } from "@shared/jwStoneCart";
import type { PublicStoneInventoryItem } from "@shared/stoneInventory";
import { createJwStoneCartStore } from "./jwStoneCartStore";
import { JW_STONE_BRAND_STYLE, jw } from "./brand";

type CartContext = { enabled: boolean; add: (line: Omit<JwStoneCartLine, "quantity">) => void };
const EMPTY: CartContext = { enabled: false, add: () => undefined };
const Context = createContext<CartContext>(EMPTY);
export const useJwStoneCart = () => useContext(Context);
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
const STATUS = { ready: "", unavailable: "This lot is no longer available. Remove it or ask JW Stone about alternatives.", insufficient_quantity: "The requested quantity exceeds unreserved stock.", price_unavailable: "This lot needs a price from JW Stone.", dimensions_required: "Exact slab dimensions are needed to calculate this price.", unsupported_unit: "This item cannot be ordered as a slab quantity." };

export function JwStoneCartProvider({ children, viewerId }: { children: ReactNode; viewerId: string | null }) {
  // Remount account state on identity change. No render may expose another account's cart.
  return viewerId ? <CartSession key={viewerId} viewerId={viewerId}>{children}</CartSession> : <Context.Provider value={EMPTY}>{children}</Context.Provider>;
}
function CartSession({ children, viewerId }: { children: ReactNode; viewerId: string }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const store = useMemo(() => {
    let storage: Storage | null = null;
    try { if (typeof window !== "undefined") storage = window.localStorage; } catch { /* Memory-only cart. */ }
    return createJwStoneCartStore(storage, viewerId);
  }, [viewerId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === store.key || event.key === store.legacyKey) store.refresh(); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [store]);
  const access = useQuery<{ viewerId: string; allowed: boolean }>({ queryKey: ["jw-stone", "cart-access", viewerId], queryFn: () => apiRequest("GET", "/api/u/jw-stone/member-pricing/cart-access"), retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: "always", refetchInterval: 30000 });
  const member = access.data?.viewerId === viewerId && access.data.allowed && !access.isError;
  const lots = useMemo(() => snapshot.lines.filter(line => line.kind === "lot").map(line => ({ inventoryPublicId: line.id, quantity: line.quantity })), [snapshot.lines]);
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
  function mutate(action: () => void) {
    if (!enabled) return;
    try { action(); setNotice(""); } catch (error) { setNotice(error instanceof Error ? error.message : "Cart could not be updated."); }
  }
  const value: CartContext = { enabled, add: line => { if (!enabled) return; mutate(() => store.add(line)); setOpen(true); } };
  const count = snapshot.lines.reduce((sum, line) => sum + line.quantity, 0);
  const allLots = snapshot.lines.length > 0 && snapshot.lines.every(line => line.kind === "lot");
  // This is an editable inquiry, not a purchase or a reservation. Keep every lot ID.
  function ask() {
    if (!enabled || !snapshot.lines.length) return;
    const message = "Please confirm availability, pricing, and pickup or delivery for these selections:\n" + snapshot.lines.map(line => `${line.quantity} slabs — ${line.stoneName.replace(/[\r\n]/g, " ").slice(0, 24)} — ${line.kind === "lot" ? line.id : "catalog selection; lot needed"}`).join("\n");
    setRequestMessage(message); setOpen(false);
  }
  return <Context.Provider value={value}>
    {children}
    {enabled ? <>
      <button type="button" style={JW_STONE_BRAND_STYLE} data-testid="jw-stone-member-cart-button" onClick={() => setOpen(true)} aria-label={`Open JW Stone cart, ${count} slabs requested`} className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex min-h-12 items-center gap-2 border border-[var(--jw-border)] bg-[var(--jw-ink)] px-4 py-2 text-sm font-semibold text-white shadow-lg"><ShoppingCart className="h-4 w-4" />Cart ({count})</button>
      <Sheet open={open} onOpenChange={setOpen}><SheetContent side="right" style={JW_STONE_BRAND_STYLE} data-testid="jw-stone-member-cart" className={`flex h-full w-full flex-col p-0 sm:max-w-lg ${jw.page}`}>
        <SheetHeader className="border-b border-[var(--jw-border)] px-5 py-5 text-left"><SheetTitle className="text-[var(--jw-ink)]">JW Stone cart</SheetTitle><SheetDescription>Choose slabs, review current lot prices, and ask JW Stone to confirm pickup or delivery. Adding a lot does not reserve it.</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!snapshot.persisted ? <p role="status" className="mb-4 text-sm text-[var(--jw-ink)]">Browser storage is unavailable. These cart changes last for this visit only.</p> : null}
          {notice ? <p role="alert" className="mb-4 text-sm text-red-700">{notice}</p> : null}
          {!snapshot.lines.length ? <p className="py-12 text-center text-[var(--jw-muted)]">Your cart is empty. Add an inventory lot or a catalog selection.</p> : <ul className="space-y-4">{snapshot.lines.map(line => {
            const checked = reviewedById.get(line.id);
            return <li key={line.id} className="border border-[var(--jw-border)] bg-[var(--jw-bg)] p-4 text-[var(--jw-ink)]">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{checked?.materialName || line.stoneName}</h3><p className="mt-1 break-all text-xs text-[var(--jw-muted)]">{line.kind === "lot" ? `Lot ${line.id}` : "Catalog selection — choose an actual lot before an order can be priced."}</p></div><button type="button" aria-label={`Remove ${line.stoneName} from cart`} onClick={() => mutate(() => store.setQuantity(line.id, 0))} className="min-h-11 min-w-11"><Trash2 className="mx-auto h-4 w-4" /></button></div>
              {checked?.status === "ready" ? <p className="mt-3 text-sm">{money(checked.unitRateCents!)} / {checked.priceUnit === "slab" ? "slab" : "sq. ft."}{checked.pricingTier === "bundle" ? " · Bundle rate" : ""}<strong className="mt-1 block">{money(checked.lineTotalCents!)}</strong></p> : checked ? <p className="mt-3 text-sm" role="status">{STATUS[checked.status]}{checked.availableQuantity !== undefined ? ` Available: ${checked.availableQuantity} slabs.` : ""}</p> : line.kind === "lot" ? <p className="mt-3 text-sm text-[var(--jw-muted)]">{review.isFetching ? "Checking current price and stock…" : "Review this lot’s current price and stock."}</p> : null}
              <div className="mt-3 flex items-center gap-2"><button type="button" aria-label={`Decrease ${line.stoneName} quantity`} onClick={() => mutate(() => store.setQuantity(line.id, line.quantity - 1))} className="min-h-11 min-w-11 border border-[var(--jw-border)]"><Minus className="mx-auto h-4 w-4" /></button><span aria-label={`${line.stoneName} requested quantity`} className="min-w-10 text-center">{line.quantity}</span><button type="button" disabled={line.quantity >= 999} aria-label={`Increase ${line.stoneName} quantity`} onClick={() => mutate(() => store.setQuantity(line.id, line.quantity + 1))} className="min-h-11 min-w-11 border border-[var(--jw-border)] disabled:opacity-40"><Plus className="mx-auto h-4 w-4" /></button><span className="text-xs text-[var(--jw-muted)]">slabs requested</span></div>
            </li>;
          })}</ul>}
        </div>
        <div className="border-t border-[var(--jw-border)] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 text-[var(--jw-ink)]">
          {review.isError ? <p role="alert" className="mb-3 text-sm">Current prices could not be confirmed. No saved price estimate is being substituted.</p> : null}
          {allLots && fresh?.readyForRequest && fresh.subtotalCents !== null ? <p className="flex justify-between gap-3 text-sm"><span>Reviewed material subtotal</span><strong>{money(fresh.subtotalCents)}</strong></p> : null}
          <p className="mt-2 text-xs text-[var(--jw-muted)]">Tax, delivery, timing, and final availability are confirmed by JW Stone. This is not a completed purchase.</p>
          {lots.length ? <button type="button" disabled={review.isFetching} onClick={() => void review.refetch()} className={`mt-3 min-h-11 w-full px-4 text-sm ${jw.ghostOnLight}`}>{review.isFetching ? "Reviewing…" : "Review current prices & availability"}</button> : null}
          <button type="button" disabled={!snapshot.lines.length} onClick={ask} className={`mt-3 min-h-12 w-full px-4 text-sm disabled:opacity-40 ${jw.accentCta}`}>Ask JW Stone about this cart</button>
          <div className="mt-2 flex gap-3"><button type="button" onClick={() => setOpen(false)} className="min-h-11 flex-1 text-sm">Continue shopping</button>{snapshot.lines.length ? <button type="button" onClick={() => { if (window.confirm("Clear this account’s JW Stone cart?")) mutate(() => store.clear()); }} className="min-h-11 flex-1 text-sm">Clear cart</button> : null}</div>
        </div>
      </SheetContent></Sheet>
      <div style={JW_STONE_BRAND_STYLE}><ExpressDirectConnectPanel open={requestMessage !== null} onClose={() => setRequestMessage(null)} profileSlug="jw-stone" businessName="JW Stone" hasViewerSession={true} allowCall={false} stayInProfile={true} requestMode="materials" initialView="request" initialRequestType="request_material" initialMessage={requestMessage} /></div>
    </> : null}
  </Context.Provider>;
}
export function JwStoneLotCartButton({ item }: { item: PublicStoneInventoryItem }) {
  const cart = useJwStoneCart();
  if (!cart.enabled) return null;
  return <button type="button" onClick={() => cart.add({ id: item.id, kind: "lot", stoneName: item.materialName })} className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm ${jw.ghostOnLight}`}><ShoppingCart className="h-4 w-4" />Add this lot to cart</button>;
}
