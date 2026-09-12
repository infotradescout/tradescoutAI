import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { z } from "zod";
import {
  JW_STONE_CART_REVIEW_PATH,
  JW_STONE_CART_REVIEW_MAX_LINES,
  jwStoneCartReviewRequestSchema,
  jwStoneInventoryPublicIdSchema,
  parseJwStoneCartReview,
  type JwStoneCartSelection,
} from "@shared/jwStoneCart";
import { jwStonePriceKey } from "@shared/jwStoneMemberPricing";
import { normalizePublicStoneInventoryImageUrls } from "@shared/stoneInventory";
import { apiRequest } from "@/lib/queryClient";
import ExpressDirectConnectPanel from "@/pages/profile-sites/ExpressDirectConnectPanel";
import { JW_STONE_BRAND_STYLE } from "./brand";
import { JW_STONE_CATALOG } from "./catalog";

const stockSchema = z.object({
  id: jwStoneInventoryPublicIdSchema,
  materialName: z.string().min(1).max(160),
  quantity: z.number().positive(),
  unit: z.string().max(40),
  assetKind: z.string().max(40),
  dimensions: z.object({
    length: z.number().positive().nullable().optional(),
    height: z.number().positive().nullable().optional(),
    thickness: z.number().positive().nullable().optional(),
    unit: z.enum(["in", "mm"]).nullable().optional(),
  }).nullable(),
  imageUrls: z.array(z.string()).max(12),
  finishQuantities: z.array(z.object({ finish: z.string().max(80), slabCount: z.number().positive() })).max(12),
});
type StockItem = z.infer<typeof stockSchema>;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const preferencesSchema = z.object({
  method: z.enum(["pickup", "delivery"]), postalCode: z.string().max(10), jobReference: z.string().max(100),
});
const emptyPreferences = { method: "pickup" as const, postalCode: "", jobReference: "" };
const preferencesKey = (viewerId: string) => `tradescout:jw-stone:cart-fulfillment:v1:${viewerId}`;
function loadPreferences(viewerId: string): z.infer<typeof preferencesSchema> {
  try {
    const parsed = preferencesSchema.safeParse(JSON.parse(window.localStorage.getItem(preferencesKey(viewerId)) || "null"));
    return parsed.success ? parsed.data : emptyPreferences;
  } catch { return emptyPreferences; }
}
function dimensionsLabel(item: StockItem): string {
  const dimensions = item.dimensions;
  if (!dimensions?.length || !dimensions.height || !dimensions.unit) return "Dimensions needed";
  return `${dimensions.length} × ${dimensions.height}${dimensions.thickness ? ` × ${dimensions.thickness}` : ""} ${dimensions.unit}`;
}
function lineMessage(status: string): string {
  switch (status) {
    case "insufficient_quantity": return "Reduce the quantity or ask JW Stone about additional stock.";
    case "dimensions_required": return "Exact slab dimensions are needed for a total.";
    case "slab_quantity_required": return "JW Stone needs to confirm the slab quantity for this stock item.";
    case "price_unavailable": return "Ask JW Stone for pricing on this selection.";
    default: return "This stock item is unavailable. Choose another item or request a quote.";
  }
}

export type JwStoneMemberCartProps = {
  viewerId: string;
  items: readonly JwStoneCartSelection[];
  onClose: () => void;
  onQuantityChange: (id: string, quantity: number) => void;
  onStockChange: (id: string, inventoryPublicId: string | undefined) => void;
};

/** Mounted only for the currently authorized JW member; all totals come from the server. */
export function JwStoneMemberCart({ viewerId, items, onClose, onQuantityChange, onStockChange }: JwStoneMemberCartProps) {
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState(() => loadPreferences(viewerId));
  const [requestOpen, setRequestOpen] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem(preferencesKey(viewerId), JSON.stringify(preferences)); } catch { /* Keep the in-memory draft when storage is unavailable. */ }
  }, [preferences, viewerId]);

  const inventoryQuery = useQuery({
    queryKey: ["jw-stone", "cart-stock", viewerId],
    queryFn: async ({ signal }) => {
      const response = await apiRequest("/api/u/jw-stone/stone-inventory/current", { signal });
      if (response?.profileSlug !== "jw-stone" || !Array.isArray(response.items)) throw new Error("Stock details could not be loaded.");
      return response.items.flatMap((raw: unknown) => {
        const item = stockSchema.safeParse(raw);
        return item.success ? [{ ...item.data, imageUrls: normalizePublicStoneInventoryImageUrls(item.data.imageUrls) }] : [];
      }) as StockItem[];
    },
    retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: "always",
  });
  const stock = inventoryQuery.isError ? [] : inventoryQuery.data || [];
  const fulfillment = preferences.method === "pickup"
    ? { method: "pickup" as const }
    : { method: "delivery" as const, postalCode: preferences.postalCode.trim() };
  const requestInput = useMemo(() => ({
    lines: items.map((item) => ({ inventoryPublicId: item.inventoryPublicId, quantity: item.quantity })),
    fulfillment,
  }), [items, preferences.method, preferences.postalCode]);
  const parsedRequest = jwStoneCartReviewRequestSchema.safeParse(requestInput);
  const fullySelected = items.length > 0 && items.every((item) => Boolean(item.inventoryPublicId));
  const validDestination = preferences.method === "pickup" || /^\d{5}(?:-\d{4})?$/.test(preferences.postalCode.trim());
  const reviewQuery = useQuery({
    queryKey: ["jw-stone", "cart-review", viewerId, requestInput],
    queryFn: async ({ signal }) => {
      const request = jwStoneCartReviewRequestSchema.parse(requestInput);
      const response = await apiRequest(JW_STONE_CART_REVIEW_PATH, { method: "POST", data: request, signal });
      return parseJwStoneCartReview(response, viewerId, request);
    },
    enabled: parsedRequest.success && !requestOpen,
    retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: "always",
    refetchInterval: requestOpen ? false : 60_000,
  });
  const review = parsedRequest.success && !reviewQuery.isFetching && !reviewQuery.isError
    ? reviewQuery.data : undefined;
  useEffect(() => {
    const status = (reviewQuery.error as { status?: number } | null)?.status;
    if (status !== 401 && status !== 403) return;
    queryClient.setQueryData(["jw-stone", "member-pricing", viewerId], null);
    onClose();
  }, [reviewQuery.error, queryClient, viewerId, onClose]);

  const requestSelections = items.flatMap((item) => {
    const catalog = JW_STONE_CATALOG.find((entry) => entry.wishlistEligible && !entry.anonymous &&
      jwStonePriceKey(entry.displayName) === item.stoneKey);
    return catalog?.displayName ? [{ itemId: catalog.id, itemName: catalog.displayName }] : [];
  }).filter((item, index, all) => all.findIndex((other) => other.itemId === item.itemId) === index);
  const requestMessage = [
    "JW Stone slab cart — quote request only; no order or inventory hold.",
    ...(preferences.jobReference.trim() ? [`Job / PO: ${preferences.jobReference.trim()}`] : []),
    ...items.map((item) => `${item.quantity} slab(s): ${item.stoneName}${item.inventoryPublicId ? ` — stock ${item.inventoryPublicId}` : " — select exact stock with JW Stone"}`),
    preferences.method === "delivery" ? `Delivery requested to ZIP ${preferences.postalCode.trim()}. Please quote freight and timing.` : "Pickup requested. Please confirm pickup readiness and timing.",
    ...(review?.materialReady && review.subtotalCents != null ? [`Material subtotal checked ${review.reviewedAt}: ${money(review.subtotalCents)}. Delivery and tax are not included; this is not a final quote.`] : []),
    "Please confirm stock, exact slab measurements, finish, final total, and availability before payment.",
  ].join("\n");
  const canRequest = items.length > 0 && items.length <= JW_STONE_CART_REVIEW_MAX_LINES && validDestination && requestMessage.length <= 5000;

  return <>
    <Dialog.Root open={!requestOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40" />
        <Dialog.Content style={JW_STONE_BRAND_STYLE} data-jw-brand="true" data-testid="jw-stone-member-cart"
          className="fixed inset-y-0 right-0 z-[71] flex h-[100dvh] w-full max-w-md flex-col bg-[var(--jw-surface)] text-[var(--jw-ink)] shadow-2xl focus:outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--jw-border)] px-5 py-4">
            <div>
              <Dialog.Title className="text-xl font-semibold">Slab cart</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-5 text-[var(--jw-muted)]">JW Stone business members · Saved on this browser</Dialog.Description>
            </div>
            <Dialog.Close className="inline-flex min-h-11 min-w-11 items-center justify-center" aria-label="Close cart"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {items.length === 0 ? <div className="border border-dashed border-[var(--jw-border)] p-6 text-center">
              <ShoppingCart className="mx-auto h-6 w-6" aria-hidden="true" /><p className="mt-3 font-semibold">Your cart is empty</p>
              <p className="mt-2 text-sm text-[var(--jw-muted)]">Add stone selections to compare stock and request a quote.</p>
            </div> : <div className="space-y-4">
              {inventoryQuery.isError ? <div role="status" className="text-sm">Stock details could not be loaded. Your selections are saved. <button type="button" onClick={() => void inventoryQuery.refetch()} className="min-h-11 underline">Try again</button></div> : null}
              {items.map((item) => {
                const actualStock = stock.find((entry) => entry.id === item.inventoryPublicId);
                const candidates = stock.filter((entry) => jwStonePriceKey(entry.materialName) === item.stoneKey);
                const checked = review?.lines.find((line) => line.inventoryPublicId === item.inventoryPublicId);
                const image = actualStock?.imageUrls[0];
                return <article key={item.id} className="border border-[var(--jw-border)] p-4" data-testid="jw-cart-line">
                  <div className="flex items-start gap-3">
                    {image ? <img src={image} alt={actualStock.materialName} className="h-16 w-20 shrink-0 object-contain" loading="lazy" /> : null}
                    <div className="min-w-0 flex-1"><h3 className="font-semibold">{actualStock?.materialName || item.stoneName}</h3>
                      {actualStock ? <p className="mt-1 text-xs text-[var(--jw-muted)]">{dimensionsLabel(actualStock)}{actualStock.finishQuantities.length ? ` · ${actualStock.finishQuantities.map((finish) => finish.finish).join(" / ")}` : ""}</p> : null}
                    </div>
                    <button type="button" onClick={() => onQuantityChange(item.id, 0)} aria-label={`Remove ${item.stoneName} from cart`} className="inline-flex min-h-11 min-w-11 items-center justify-center"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <label className="mt-3 block text-xs">Stock selection
                    <select aria-label={`Stock for ${item.stoneName}`} value={item.inventoryPublicId || ""}
                      onChange={(event) => onStockChange(item.id, event.target.value || undefined)}
                      className="mt-1 min-h-11 w-full border border-[var(--jw-border)] bg-[var(--jw-surface)] px-2 text-sm text-[var(--jw-ink)]">
                      <option value="">Choose exact stock</option>
                      {item.inventoryPublicId && !candidates.some((entry) => entry.id === item.inventoryPublicId) ? <option value={item.inventoryPublicId}>{inventoryQuery.isLoading ? "Loading stock…" : "Previously selected stock"}</option> : null}
                      {candidates.map((entry) => <option key={entry.id} value={entry.id}>{entry.id.slice(-8)} · {dimensionsLabel(entry)} · {entry.quantity} {entry.unit}</option>)}
                    </select>
                  </label>
                  {item.inventoryPublicId ? <p className="mt-1 break-all text-[10px] text-[var(--jw-muted)]">Stock ID: {item.inventoryPublicId}</p> : <p className="mt-2 text-xs text-[var(--jw-muted)]">Choose stock for a checked total, or ask JW Stone to match this selection.</p>}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center border border-[var(--jw-border)]">
                      <button type="button" onClick={() => onQuantityChange(item.id, item.quantity - 1)} className="min-h-11 min-w-11" aria-label={`Decrease ${item.stoneName} quantity`}><Minus className="mx-auto h-4 w-4" /></button>
                      <input type="number" min={1} max={999} inputMode="numeric" value={item.quantity} aria-label={`Quantity for ${item.stoneName}`}
                        onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= 999) onQuantityChange(item.id, value); }}
                        className="min-h-11 w-14 bg-[var(--jw-surface)] text-center text-sm text-[var(--jw-ink)]" />
                      <button type="button" disabled={item.quantity >= 999} onClick={() => onQuantityChange(item.id, item.quantity + 1)} className="min-h-11 min-w-11 disabled:opacity-40" aria-label={`Increase ${item.stoneName} quantity`}><Plus className="mx-auto h-4 w-4" /></button>
                    </div>
                    <span className="text-xs text-[var(--jw-muted)]">slabs</span>
                  </div>
                  {checked?.status === "ready" ? <div className="mt-3 text-sm" data-testid="jw-cart-line-total"><strong>{money(checked.oneSlabTotalCents * item.quantity)}</strong><p className="mt-1 text-xs text-[var(--jw-muted)]">{money(checked.unitRateCents)} / sq. ft. · {checked.pricingTier === "bundle" ? "Quantity rate applied" : "Slab rate"}</p></div>
                    : checked ? <p role="status" className="mt-3 text-xs">{lineMessage(checked.status)}{checked.status === "insufficient_quantity" ? ` ${checked.availableQuantity} slabs available for the combined selection.` : ""}</p> : null}
                </article>;
              })}
              <fieldset className="border border-[var(--jw-border)] p-4">
                <legend className="px-1 text-sm font-semibold">Pickup or delivery</legend>
                <div className="flex gap-5">{(["pickup", "delivery"] as const).map((method) => <label key={method} className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="jw-cart-fulfillment" value={method} checked={preferences.method === method} onChange={() => setPreferences((current) => ({ ...current, method }))} />{method === "pickup" ? "Pickup" : "Delivery"}</label>)}</div>
                {preferences.method === "delivery" ? <label className="mt-2 block text-sm">Delivery ZIP<input autoComplete="postal-code" inputMode="numeric" maxLength={10} value={preferences.postalCode} onChange={(event) => setPreferences((current) => ({ ...current, postalCode: event.target.value }))} className="mt-1 min-h-11 w-full border border-[var(--jw-border)] bg-[var(--jw-surface)] px-3 text-[var(--jw-ink)]" /><span className="mt-2 block text-xs text-[var(--jw-muted)]">JW Stone will quote delivery cost and timing. No delivery charge has been added.</span></label> : <p className="text-xs text-[var(--jw-muted)]">Pickup timing is arranged with JW Stone.</p>}
                <label className="mt-4 block text-sm">Job / PO reference <span className="text-[var(--jw-muted)]">(optional)</span><input maxLength={100} value={preferences.jobReference} onChange={(event) => setPreferences((current) => ({ ...current, jobReference: event.target.value }))} className="mt-1 min-h-11 w-full border border-[var(--jw-border)] bg-[var(--jw-surface)] px-3 text-[var(--jw-ink)]" /></label>
              </fieldset>
            </div>}
          </div>
          <div className="border-t border-[var(--jw-border)] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div role="status" aria-live="polite" className="text-sm">
              {review?.materialReady && review.subtotalCents != null ? <div className="flex justify-between gap-4" data-testid="jw-cart-reviewed-subtotal"><span>Material subtotal</span><strong>{money(review.subtotalCents)}</strong></div>
                : reviewQuery.isFetching ? "Checking current prices and stock…"
                : reviewQuery.isError ? "The total could not be checked. Your cart is saved; retry or request a quote."
                : items.length > JW_STONE_CART_REVIEW_MAX_LINES ? "Review up to 50 selections at a time."
                : items.length && !validDestination ? "Enter a valid delivery ZIP."
                : fullySelected && !parsedRequest.success ? "Reduce the combined quantity for a stock item to 999 or fewer."
                : items.length ? "A full total will appear after every stock selection is checked." : null}
            </div>
            {items.length ? <p className="mt-2 text-xs leading-5 text-[var(--jw-muted)]">Delivery and tax are not included. This cart does not reserve stock or charge payment.</p> : null}
            <div className="mt-3 flex gap-2">
              {parsedRequest.success ? <button type="button" disabled={reviewQuery.isFetching} onClick={() => void reviewQuery.refetch()} className="min-h-11 flex-1 border border-[var(--jw-border)] px-3 text-sm disabled:opacity-40">Recheck total</button> : null}
              <button type="button" disabled={!canRequest} onClick={() => setRequestOpen(true)} className="min-h-11 flex-1 bg-[var(--jw-accent)] px-3 text-sm font-semibold text-[var(--jw-on-accent)] disabled:opacity-40" data-testid="jw-cart-request-quote">Request quote</button>
            </div>
            {requestMessage.length > 5000 ? <p className="mt-2 text-xs">Please split this cart into smaller quote requests.</p> : null}
            <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full text-sm underline">Continue shopping</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    {requestOpen ? <ExpressDirectConnectPanel open onClose={() => setRequestOpen(false)} profileSlug="jw-stone" businessName="JW Stone" hasViewerSession allowCall={false} stayInProfile requestMode="materials" initialView="request" initialRequestType="request_material" initialStoneSelections={requestSelections} initialMessage={requestMessage} /> : null}
  </>;
}
