import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useJwStoneFeatures } from "./useJwStoneFeatures";
import { ShoppingCart } from "lucide-react";
import {
  JW_STONE_PRICING_PROFILE_SLUG, jwStonePriceKey,
  type JwStoneInternalPrice, type JwStoneMemberPrice,
  type JwStonePricingAccess, type JwStonePricingResponse,
} from "@shared/jwStoneMemberPricing";
import {
  JW_STONE_CART_STORAGE_PREFIX, JW_STONE_LEGACY_CART_STORAGE_PREFIX,
  JW_STONE_CART_MAX_LINES, jwStoneInventoryPublicIdSchema, restoreJwStoneCart,
  type JwStoneCartSelection, type JwStoneCartDraft,
} from "@shared/jwStoneCart";
import type { StoneInventoryDimensions } from "@shared/stoneInventory";
import { apiRequest } from "@/lib/queryClient";
import { parseSlabDimension, type SlabDimension } from "./slabDimensions";
import { JwStoneMemberCart } from "./JwStoneMemberCartLoader";
import { JW_STONE_BRAND_STYLE } from "./brand";
import type { JwStoneOfferContext } from "@shared/jwStoneOffer";
const JwStoneOfferPanel = lazy(() => import("@/pages/profile-sites/ExpressDirectConnectPanel"));
const BundleWorkspace = lazy(() => import("./JwStoneBundleWorkspace"));
const ShoppingAccess = lazy(() => import("./JwStoneShoppingAccess"));

type VisibleJwStonePrice = JwStoneMemberPrice & Readonly<{ access: JwStonePricingAccess; landedCostCents?: number | null }>;
type ShoppingIntent = { viewerId: string } & ({ kind: "bundle" } | { kind: "offer"; item: JwStoneCartDraft });
type JwStoneMemberPricingContextValue = Readonly<{
  access: JwStonePricingAccess | null;
  viewerId: string;
  priceFor: (stoneName: string | null | undefined) => VisibleJwStonePrice | null;
  cartEnabled: boolean;
  cartCount: number;
  items: readonly JwStoneCartSelection[];
  addToCart: (item: JwStoneCartDraft) => void;
  makeOffer: (item: JwStoneCartDraft) => void;
  openBundle: () => void;
  openCart: () => void;
  updateQuantity: (id: string, quantity: number) => void;
}>;
const EMPTY_CONTEXT: JwStoneMemberPricingContextValue = Object.freeze({
  access: null, viewerId: "", priceFor: () => null, cartEnabled: false, cartCount: 0, items: [],
  addToCart: () => undefined, makeOffer: () => undefined, openBundle: () => undefined,
  openCart: () => undefined, updateQuantity: () => undefined,
});
const JwStoneMemberPricingContext = createContext(EMPTY_CONTEXT);
export function useJwStoneShopping() { return useContext(JwStoneMemberPricingContext); }
function isCents(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 10_000_000;
}
function readMemberCart(viewerId: string): readonly JwStoneCartSelection[] {
  if (typeof window === "undefined" || !viewerId) return [];
  try {
    const raw = window.localStorage.getItem(`${JW_STONE_CART_STORAGE_PREFIX}${viewerId}`)
      ?? window.localStorage.getItem(`${JW_STONE_LEGACY_CART_STORAGE_PREFIX}${viewerId}`);
    if (!raw || raw.length > 256_000) return [];
    return restoreJwStoneCart(JSON.parse(raw));
  } catch { return []; }
}
function writeMemberCart(viewerId: string, items: readonly JwStoneCartSelection[]): void {
  if (typeof window === "undefined" || !viewerId) return;
  try {
    window.localStorage.setItem(`${JW_STONE_CART_STORAGE_PREFIX}${viewerId}`, JSON.stringify(restoreJwStoneCart(items)));
    window.localStorage.removeItem(`${JW_STONE_LEGACY_CART_STORAGE_PREFIX}${viewerId}`);
  } catch { /* An unavailable browser store must not prevent in-memory shopping. */ }
}

export function sanitizeJwStonePricingResponse(value: unknown, viewerId: string): JwStonePricingResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.profileSlug !== JW_STONE_PRICING_PROFILE_SLUG || record.viewerId !== viewerId ||
      record.currency !== "USD" || record.unit !== "square_foot" ||
      (record.access !== "member" && record.access !== "internal") ||
      typeof record.sourceUpdatedAt !== "string" || Number.isNaN(new Date(record.sourceUpdatedAt).getTime()) ||
      !Array.isArray(record.prices) || record.prices.length > 500) return null;
  const access = record.access;
  const seen = new Set<string>();
  const prices: Array<JwStoneMemberPrice | JwStoneInternalPrice> = [];
  for (const rawPrice of record.prices) {
    if (!rawPrice || typeof rawPrice !== "object" || Array.isArray(rawPrice)) return null;
    const price = rawPrice as Record<string, unknown>;
    const stoneName = typeof price.stoneName === "string" ? price.stoneName.trim() : "";
    const stoneKey = typeof price.stoneKey === "string" ? price.stoneKey.trim() : "";
    if (!stoneName || !stoneKey || stoneKey !== jwStonePriceKey(stoneName) || seen.has(stoneKey) ||
        !isCents(price.slabPriceCents) || !isCents(price.bundlePriceCents)) return null;
    if (price.bundleMinSlabs !== undefined && (!Number.isInteger(price.bundleMinSlabs) ||
        Number(price.bundleMinSlabs) < 2 || Number(price.bundleMinSlabs) > 999)) return null;
    seen.add(stoneKey);
    const memberPrice = { stoneName, stoneKey, slabPriceCents: price.slabPriceCents, bundlePriceCents: price.bundlePriceCents,
      ...(price.bundleMinSlabs === undefined ? {} : { bundleMinSlabs: price.bundleMinSlabs as number }) };
    if (access === "internal") {
      if (price.landedCostCents !== null && !isCents(price.landedCostCents)) return null;
      prices.push({ ...memberPrice, landedCostCents: price.landedCostCents });
    } else {
      prices.push(memberPrice);
    }
  }
  return { profileSlug: JW_STONE_PRICING_PROFILE_SLUG, viewerId, currency: "USD", unit: "square_foot",
    sourceUpdatedAt: new Date(record.sourceUpdatedAt).toISOString(), access, prices } as JwStonePricingResponse;
}

export function JwStoneMemberPricingProvider({ children, viewerId, onOpenCart }: {
  children: ReactNode; viewerId: string | null; onOpenCart?: () => void;
}) {
  const { enabled: enhancementsEnabled } = useJwStoneFeatures();
  const queryClient = useQueryClient();
  const normalizedViewerId = enhancementsEnabled ? String(viewerId || "").trim() : "";
  const pricingQuery = useQuery({
    queryKey: ["jw-stone", "member-pricing", normalizedViewerId],
    queryFn: async () => sanitizeJwStonePricingResponse(await apiRequest("GET", "/api/u/jw-stone/member-pricing"), normalizedViewerId),
    enabled: Boolean(normalizedViewerId), retry: false, staleTime: 4 * 60 * 1000, gcTime: 0, refetchOnWindowFocus: "always",
  });
  const [cart, setCart] = useState<readonly JwStoneCartSelection[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<ShoppingIntent | null>(null);
  const [stoneOffer, setStoneOffer] = useState<JwStoneOfferContext | null>(null);
  const [loadedCartViewer, setLoadedCartViewer] = useState<string | null>(null);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const refreshPricing = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["jw-stone", "member-pricing"] });
  }, [queryClient]);
  useEffect(() => {
    setCart(normalizedViewerId ? readMemberCart(normalizedViewerId) : []);
    setLoadedCartViewer(normalizedViewerId || null);
    setStoneOffer(null);
    setCartOpen(false);
    setBundleOpen(false);
    // Only an unauthenticated entry may continue through a new login. A former
    // member's offer must never move into a different user's session.
    setPendingIntent(current => current?.viewerId ? null : current);
  }, [normalizedViewerId]);
  useEffect(() => {
    if (!normalizedViewerId || loadedCartViewer !== normalizedViewerId) return;
    writeMemberCart(normalizedViewerId, cart);
  }, [cart, loadedCartViewer, normalizedViewerId]);
  const response = !pricingQuery.isError && pricingQuery.data?.viewerId === normalizedViewerId ? pricingQuery.data : null;
  const cartEnabled = Boolean(normalizedViewerId && response?.access === "member" && loadedCartViewer === normalizedViewerId);
  const openCart = useCallback(() => {
    onOpenCart?.(); setBundleOpen(false); setStoneOffer(null); setCartOpen(true); refreshPricing();
  }, [onOpenCart, refreshPricing]);
  const openBundle = useCallback(() => {
    onOpenCart?.(); setCartOpen(false); setStoneOffer(null);
    if (cartEnabled) setBundleOpen(true);
    else setPendingIntent({ kind: "bundle", viewerId: normalizedViewerId });
  }, [onOpenCart, cartEnabled, normalizedViewerId]);
  const addToCart = useCallback((item: JwStoneCartDraft) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) return current.map((entry) => entry.id === item.id ? { ...entry, quantity: Math.min(999, entry.quantity + 1) } : entry);
      if (current.length >= JW_STONE_CART_MAX_LINES) return current;
      return restoreJwStoneCart([...current, { ...item, quantity: 1 }]);
    });
    // Choosing slabs in the standalone builder must not replace it with a cart.
    if (!bundleOpen) { onOpenCart?.(); setCartOpen(true); }
  }, [onOpenCart, bundleOpen]);
  const makeOffer = useCallback((item: JwStoneCartDraft) => {
    onOpenCart?.(); setCartOpen(false); setBundleOpen(false);
    if (cartEnabled) setStoneOffer({ scope: "stone", viewerId: normalizedViewerId, stoneName: item.stoneName, inventoryPublicId: item.inventoryPublicId });
    else setPendingIntent({ kind: "offer", viewerId: normalizedViewerId, item });
  }, [onOpenCart, normalizedViewerId, cartEnabled]);
  useEffect(() => {
    if (!pendingIntent || !cartEnabled || (pendingIntent.viewerId && pendingIntent.viewerId !== normalizedViewerId)) return;
    if (pendingIntent.kind === "bundle") setBundleOpen(true);
    else setStoneOffer({ scope: "stone", viewerId: normalizedViewerId, stoneName: pendingIntent.item.stoneName, inventoryPublicId: pendingIntent.item.inventoryPublicId });
    setPendingIntent(null);
  }, [pendingIntent, cartEnabled, normalizedViewerId]);
  const updateCartQuantity = useCallback((id: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999) return;
    setCart((current) => quantity === 0 ? current.filter((item) => item.id !== id)
      : current.map((item) => item.id === id ? { ...item, quantity } : item));
  }, []);
  const updateCartStock = useCallback((id: string, inventoryPublicId: string | undefined) => {
    if (inventoryPublicId !== undefined && !jwStoneInventoryPublicIdSchema.safeParse(inventoryPublicId).success) return;
    setCart((current) => current.map((item) => item.id === id ? { ...item, inventoryPublicId } : item));
  }, []);
  const value = useMemo<JwStoneMemberPricingContextValue>(() => {
    const priceMap = new Map<string, VisibleJwStonePrice>((response?.prices || []).map((price): [string, VisibleJwStonePrice] =>
      [price.stoneKey, Object.freeze({ ...price, access: response!.access }) as VisibleJwStonePrice]));
    return Object.freeze({ access: response?.access ?? null, viewerId: normalizedViewerId,
      priceFor: (stoneName: string | null | undefined) => priceMap.get(jwStonePriceKey(stoneName)) || null,
      cartEnabled, cartCount: cartEnabled ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0,
      items: cartEnabled ? cart : [], openBundle, openCart, makeOffer,
      addToCart: cartEnabled ? addToCart : () => undefined,
      updateQuantity: cartEnabled ? updateCartQuantity : () => undefined });
  }, [response, normalizedViewerId, cartEnabled, cart, openBundle, openCart, makeOffer, addToCart, updateCartQuantity]);
  return <JwStoneMemberPricingContext.Provider value={value}>
    {children}
    {pendingIntent ? <Suspense fallback={<p role="status">Opening business-member access…</p>}>
      <ShoppingAccess key={pendingIntent.kind} access={response?.access ?? null} onClose={() => setPendingIntent(null)} onAccountChange={refreshPricing} />
    </Suspense> : null}
    {value.cartEnabled ? <>
      <button type="button" style={JW_STONE_BRAND_STYLE} data-testid="jw-stone-member-cart-button"
        onClick={openCart}
        className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex min-h-12 items-center gap-2 border border-[var(--jw-border)] bg-[var(--jw-ink)] px-4 py-2 text-sm font-semibold text-white shadow-lg sm:right-6"
        aria-label={`Open JW Stone cart, ${value.cartCount} ${value.cartCount === 1 ? "slab" : "slabs"}`}>
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />Cart
        {value.cartCount > 0 ? <span className="inline-flex min-w-5 justify-center rounded-full bg-[var(--jw-accent)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--jw-on-accent)]">{value.cartCount}</span> : null}
      </button>
      {cartOpen ? <JwStoneMemberCart key={normalizedViewerId} viewerId={normalizedViewerId} items={cart} onClose={closeCart} onQuantityChange={updateCartQuantity} onStockChange={updateCartStock} /> : null}
      {bundleOpen ? <Suspense fallback={<p role="status">Opening bundle builder…</p>}><BundleWorkspace key={normalizedViewerId} onClose={() => setBundleOpen(false)} /></Suspense> : null}
      {stoneOffer && stoneOffer.viewerId === normalizedViewerId ? <Suspense fallback={<p role="status">Loading offer form…</p>}>
        <JwStoneOfferPanel key={normalizedViewerId} open onClose={() => setStoneOffer(null)} profileSlug="jw-stone" businessName="JW Stone" hasViewerSession allowCall={false} stayInProfile requestMode="materials" initialView="request" initialRequestType="make_offer" initialStoneName={stoneOffer.scope === "stone" ? stoneOffer.stoneName : undefined} jwStoneOffer={stoneOffer} />
      </Suspense> : null}
    </> : null}
  </JwStoneMemberPricingContext.Provider>;
}

export function JwStoneBundleEntry({ className, onOpen }: { className?: string; onOpen?: () => void }) {
  const shopping = useJwStoneShopping();
  return <button type="button" data-testid="jw-storefront-build-bundle" onClick={() => { onOpen?.(); shopping.openBundle(); }} className={className}>Build a Bundle</button>;
}

/** One primary stone action. Guest entry opens membership, never an unrelated inquiry. */
export function JwStoneOfferAction({ stoneName, inventoryPublicId, presentation, className }: {
  stoneName: string; inventoryPublicId?: string; presentation: "card" | "detail" | "inventory"; className?: string;
}) {
  const shopping = useJwStoneShopping();
  const stock = jwStoneInventoryPublicIdSchema.safeParse(inventoryPublicId);
  const name = stoneName.trim();
  return <button type="button" data-testid={`jw-stone-make-offer-${presentation}`} className={className}
    onClick={() => shopping.makeOffer({ id: stock.success ? `stock:${stock.data}` : `offer:${jwStonePriceKey(name)}`, stoneName: name, stoneKey: jwStonePriceKey(name), ...(stock.success ? { inventoryPublicId: stock.data } : {}) })}>
    Make an Offer
  </button>;
}

export function useJwStoneMemberPrice(stoneName: string | null | undefined): VisibleJwStonePrice | null {
  return useContext(JwStoneMemberPricingContext).priceFor(stoneName);
}
const USD_PER_SQUARE_FOOT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
function formatCents(cents: number): string { return USD_PER_SQUARE_FOOT.format(cents / 100); }
export type JwStoneSlabDimensionsInput = string | StoneInventoryDimensions | null | undefined;
export type JwStoneSlabCostEstimate = Readonly<{ minimumTotalCents: number; maximumTotalCents: number }>;
function isValidSlabDimension(dimension: SlabDimension): boolean {
  return Number.isFinite(dimension.widthIn) && Number.isFinite(dimension.heightIn) &&
    dimension.widthIn >= 20 && dimension.heightIn >= 20 && dimension.widthIn <= 220 && dimension.heightIn <= 220;
}
function slabDimensionsInInches(input: JwStoneSlabDimensionsInput): readonly SlabDimension[] {
  if (!input) return [];
  if (typeof input === "string") {
    const unique = new Map<string, SlabDimension>();
    for (const label of input.split(/\s*·\s*/).slice(0, 4)) {
      const dimension = parseSlabDimension(label);
      if (!dimension || !isValidSlabDimension(dimension)) continue;
      unique.set(`${dimension.widthIn}x${dimension.heightIn}`, dimension);
    }
    return [...unique.values()];
  }
  const length = input.length;
  const height = input.height;
  if (typeof length !== "number" || typeof height !== "number" || !Number.isFinite(length) || !Number.isFinite(height) || length <= 0 || height <= 0) return [];
  const unit = input.unit || "in";
  if (unit !== "in" && unit !== "mm") return [];
  const inchesPerUnit = unit === "mm" ? 1 / 25.4 : 1;
  const dimension = { widthIn: length * inchesPerUnit, heightIn: height * inchesPerUnit };
  return isValidSlabDimension(dimension) ? [dimension] : [];
}
/** Estimate one slab from listed face dimensions; the cart obtains checked totals separately. */
export function estimateJwStoneSlabCost(slabPriceCents: number, dimensions: JwStoneSlabDimensionsInput): JwStoneSlabCostEstimate | null {
  if (!isCents(slabPriceCents)) return null;
  const totals = slabDimensionsInInches(dimensions)
    .map(({ widthIn, heightIn }) => Math.round((widthIn * heightIn * slabPriceCents) / 144))
    .filter((total) => Number.isSafeInteger(total) && total > 0).sort((a, b) => a - b);
  return totals.length ? { minimumTotalCents: totals[0], maximumTotalCents: totals[totals.length - 1] } : null;
}
function formatEstimatedSlabTotal(estimate: JwStoneSlabCostEstimate): string {
  const minimum = formatCents(estimate.minimumTotalCents);
  return estimate.maximumTotalCents === estimate.minimumTotalCents ? minimum : `${minimum}–${formatCents(estimate.maximumTotalCents)}`;
}
function cartItemId(stoneKey: string, dimensions: JwStoneSlabDimensionsInput): string {
  const dimensionKey = typeof dimensions === "string" ? dimensions.trim().slice(0, 240)
    : dimensions ? `${dimensions.length}x${dimensions.height}${dimensions.unit || "in"}` : "unsized";
  return `${stoneKey}:${dimensionKey}`;
}

export function JwStoneMemberPriceDisplay({ stoneName, slabDimensions, inventoryPublicId, presentation = "card", showOfferAction = true }: {
  stoneName: string | null | undefined;
  slabDimensions?: JwStoneSlabDimensionsInput;
  inventoryPublicId?: string;
  presentation?: "card" | "detail" | "inventory";
  showOfferAction?: boolean;
}) {
  const context = useContext(JwStoneMemberPricingContext);
  const price = context.priceFor(stoneName);
  if (!price) return null;
  const internal = price.access === "internal";
  const compact = presentation !== "detail";
  const slabEstimate = estimateJwStoneSlabCost(price.slabPriceCents, slabDimensions);
  const stockId = jwStoneInventoryPublicIdSchema.safeParse(inventoryPublicId);
  return <div data-testid={`jw-stone-member-price-${presentation}`} className={compact ? "mt-3 border-y border-[var(--jw-border)] py-2.5 text-center" : "mt-6 border-y border-[var(--jw-border)] py-4"}>
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--jw-accent)]">{internal ? "JW Stone pricing" : "Business member pricing"}</p>
    <dl className={compact ? "mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs" : "mt-2 grid gap-2 text-sm sm:grid-cols-2"}>
      <div><dt className="inline text-[var(--jw-muted)]">{price.bundleMinSlabs === 2 ? "1 slab " : "Slab "}</dt><dd className="inline font-semibold text-[var(--jw-ink)]">{formatCents(price.slabPriceCents)} / sq. ft.</dd></div>
      <div><dt className="inline text-[var(--jw-muted)]">{price.bundleMinSlabs ? `${price.bundleMinSlabs}+ slabs ` : "7+ slabs "}</dt><dd className="inline font-semibold text-[var(--jw-ink)]">{formatCents(price.bundlePriceCents)} / sq. ft.</dd></div>
      {slabEstimate ? <div className={compact ? "basis-full" : "border-t border-[var(--jw-border)] pt-2 sm:col-span-2"}>
        <dt className="inline text-[var(--jw-muted)]">Approx. slab total </dt>
        <dd className="inline font-semibold text-[var(--jw-ink)]" data-testid="jw-stone-estimated-slab-total">{formatEstimatedSlabTotal(slabEstimate)}
          {compact ? null : <span className="mt-1 block text-xs font-normal leading-5 text-[var(--jw-muted)]">Based on the listed dimensions and slab rate. Confirm the exact slab size and final price with JW Stone.</span>}
        </dd>
      </div> : null}
      {internal && price.landedCostCents != null ? <div className={compact ? "basis-full" : "sm:col-span-2"}><dt className="inline text-[var(--jw-muted)]">Internal landed cost </dt><dd className="inline font-semibold text-[var(--jw-ink)]">{formatCents(price.landedCostCents)} / sq. ft.</dd></div> : null}
    </dl>
    {context.cartEnabled ? <button type="button" data-testid={`jw-stone-add-to-cart-${presentation}`} onClick={() => context.addToCart({
      id: stockId.success ? `stock:${stockId.data}` : cartItemId(price.stoneKey, slabDimensions),
      stoneName: price.stoneName, stoneKey: price.stoneKey,
      ...(stockId.success ? { inventoryPublicId: stockId.data } : {}),
    })} className={compact ? "mt-2 inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--jw-border)] px-3 text-xs font-semibold text-[var(--jw-ink)] hover:bg-[var(--jw-bg)]" : "mt-4 inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--jw-ink)] px-4 py-2 text-sm font-semibold text-white"}>
      <ShoppingCart className="h-4 w-4" aria-hidden="true" />Add slab to cart
    </button> : null}
    {context.cartEnabled && showOfferAction ? <JwStoneOfferAction stoneName={price.stoneName} inventoryPublicId={inventoryPublicId} presentation={presentation} className="ml-2 mt-2 inline-flex min-h-11 items-center justify-center border border-[var(--jw-accent)] px-3 text-xs font-semibold text-[var(--jw-ink)]" /> : null}
    {context.cartEnabled && price.bundlePriceCents < price.slabPriceCents && (price.bundleMinSlabs ?? 7) <= 7
      ? <p className="mt-2 text-xs text-[var(--jw-muted)]">Build a bundle: mix 7 eligible slabs for bundle pricing.</p> : null}
  </div>;
}
