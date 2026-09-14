import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import {
  JW_STONE_PRICING_PROFILE_SLUG,
  jwStonePriceKey,
  type JwStoneInternalPrice,
  type JwStoneMemberPrice,
  type JwStonePricingAccess,
  type JwStonePricingResponse,
} from "@shared/jwStoneMemberPricing";
import { jwStoneInventoryPublicIdSchema, type JwStoneCartDraft } from "@shared/jwStoneCart";
import type { StoneInventoryDimensions } from "@shared/stoneInventory";
import { apiRequest } from "@/lib/queryClient";
import { parseSlabDimension, type SlabDimension } from "./slabDimensions";
import { JwStoneMemberCart } from "./JwStoneMemberCartLoader";
import { JW_STONE_BRAND_STYLE } from "./brand";
import { createJwStoneCartStore } from "./jwStoneCartStore";

type VisibleJwStonePrice = JwStoneMemberPrice &
  Readonly<{ access: JwStonePricingAccess; landedCostCents?: number | null }>;
type JwStoneMemberPricingContextValue = Readonly<{
  access: JwStonePricingAccess | null;
  priceFor: (stoneName: string | null | undefined) => VisibleJwStonePrice | null;
  cartEnabled: boolean;
  cartCount: number;
  addToCart: (item: JwStoneCartDraft) => void;
}>;
const EMPTY_CONTEXT: JwStoneMemberPricingContextValue = Object.freeze({
  access: null,
  priceFor: () => null,
  cartEnabled: false,
  cartCount: 0,
  addToCart: () => undefined,
});
const JwStoneMemberPricingContext = createContext(EMPTY_CONTEXT);
function isCents(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 10_000_000;
}
export function sanitizeJwStonePricingResponse(
  value: unknown,
  viewerId: string
): JwStonePricingResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.profileSlug !== JW_STONE_PRICING_PROFILE_SLUG ||
    record.viewerId !== viewerId ||
    record.currency !== "USD" ||
    record.unit !== "square_foot" ||
    (record.access !== "member" && record.access !== "internal") ||
    typeof record.sourceUpdatedAt !== "string" ||
    Number.isNaN(new Date(record.sourceUpdatedAt).getTime()) ||
    !Array.isArray(record.prices) ||
    record.prices.length > 500
  )
    return null;
  const access = record.access;
  const seen = new Set<string>();
  const prices: Array<JwStoneMemberPrice | JwStoneInternalPrice> = [];
  for (const rawPrice of record.prices) {
    if (!rawPrice || typeof rawPrice !== "object" || Array.isArray(rawPrice)) return null;
    const price = rawPrice as Record<string, unknown>;
    const stoneName = typeof price.stoneName === "string" ? price.stoneName.trim() : "";
    const stoneKey = typeof price.stoneKey === "string" ? price.stoneKey.trim() : "";
    if (
      !stoneName ||
      !stoneKey ||
      stoneKey !== jwStonePriceKey(stoneName) ||
      seen.has(stoneKey) ||
      !isCents(price.slabPriceCents) ||
      !isCents(price.bundlePriceCents)
    )
      return null;
    if (
      price.bundleMinSlabs !== undefined &&
      (!Number.isInteger(price.bundleMinSlabs) ||
        Number(price.bundleMinSlabs) < 2 ||
        Number(price.bundleMinSlabs) > 999)
    )
      return null;
    seen.add(stoneKey);
    const memberPrice = {
      stoneName,
      stoneKey,
      slabPriceCents: price.slabPriceCents,
      bundlePriceCents: price.bundlePriceCents,
      ...(price.bundleMinSlabs === undefined
        ? {}
        : { bundleMinSlabs: price.bundleMinSlabs as number }),
    };
    if (access === "internal") {
      if (price.landedCostCents !== null && !isCents(price.landedCostCents)) return null;
      prices.push({ ...memberPrice, landedCostCents: price.landedCostCents });
    } else {
      // Member projections deliberately discard any unexpected internal field.
      prices.push(memberPrice);
    }
  }
  return {
    profileSlug: JW_STONE_PRICING_PROFILE_SLUG,
    viewerId,
    currency: "USD",
    unit: "square_foot",
    sourceUpdatedAt: new Date(record.sourceUpdatedAt).toISOString(),
    access,
    prices,
  } as JwStonePricingResponse;
}

export function JwStoneMemberPricingProvider({
  children,
  viewerId,
  onOpenCart,
}: {
  children: ReactNode;
  viewerId: string | null;
  onOpenCart?: () => void;
}) {
  const normalizedViewerId = String(viewerId || "").trim();
  return normalizedViewerId ? (
    <JwStoneMemberSession
      key={normalizedViewerId}
      viewerId={normalizedViewerId}
      onOpenCart={onOpenCart}
    >
      {children}
    </JwStoneMemberSession>
  ) : (
    <JwStoneMemberPricingContext.Provider value={EMPTY_CONTEXT}>
      {children}
    </JwStoneMemberPricingContext.Provider>
  );
}

function JwStoneMemberSession({
  children,
  viewerId,
  onOpenCart,
}: {
  children: ReactNode;
  viewerId: string;
  onOpenCart?: () => void;
}) {
  const pricingQuery = useQuery({
    queryKey: ["jw-stone", "member-pricing", viewerId],
    queryFn: async () =>
      sanitizeJwStonePricingResponse(
        await apiRequest("GET", "/api/u/jw-stone/member-pricing"),
        viewerId
      ),
    retry: false,
    staleTime: 4 * 60 * 1000,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
  const accessQuery = useQuery<{ viewerId: string; allowed: boolean }>({
    queryKey: ["jw-stone", "cart-access", viewerId],
    queryFn: () => apiRequest("GET", "/api/u/jw-stone/member-pricing/cart-access"),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
  });
  const cartEnabled =
    !accessQuery.isError &&
    accessQuery.data?.viewerId === viewerId &&
    accessQuery.data.allowed === true;
  const store = useMemo(() => {
    let storage: Storage | null = null;
    try {
      if (typeof window !== "undefined") storage = window.localStorage;
    } catch {
      /* Use a visible memory-only cart. */
    }
    return createJwStoneCartStore(storage, viewerId);
  }, [viewerId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const closeCart = useCallback(() => setCartOpen(false), []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === store.key || event.key === store.legacyKey)
        store.refresh();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [store]);
  useEffect(() => {
    if (!cartEnabled) setCartOpen(false);
  }, [cartEnabled]);
  const mutate = useCallback(
    (action: () => void) => {
      if (!cartEnabled) return;
      try {
        action();
        setNotice("");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Cart could not be updated.");
      }
    },
    [cartEnabled]
  );
  const addToCart = useCallback(
    (item: JwStoneCartDraft) => {
      if (!cartEnabled) return;
      mutate(() => store.add(item));
      onOpenCart?.();
      setCartOpen(true);
    },
    [cartEnabled, mutate, onOpenCart, store]
  );
  const updateCartQuantity = useCallback(
    (id: string, quantity: number) => mutate(() => store.setQuantity(id, quantity)),
    [mutate, store]
  );
  const updateCartStock = useCallback(
    (id: string, inventoryPublicId: string | undefined) =>
      mutate(() => store.setStock(id, inventoryPublicId)),
    [mutate, store]
  );
  const value = useMemo<JwStoneMemberPricingContextValue>(() => {
    const memberAccessDenied =
      accessQuery.data?.viewerId === viewerId &&
      accessQuery.data.allowed === false &&
      pricingQuery.data?.access === "member";
    const response =
      !pricingQuery.isError && !memberAccessDenied && pricingQuery.data?.viewerId === viewerId
        ? pricingQuery.data
        : null;
    const priceMap = new Map<string, VisibleJwStonePrice>(
      (response?.prices || []).map((price): [string, VisibleJwStonePrice] => [
        price.stoneKey,
        Object.freeze({ ...price, access: response!.access }) as VisibleJwStonePrice,
      ])
    );
    return Object.freeze({
      access: response?.access || null,
      priceFor: (stoneName: string | null | undefined) =>
        priceMap.get(jwStonePriceKey(stoneName)) || null,
      cartEnabled,
      cartCount: cartEnabled ? snapshot.lines.reduce((sum, item) => sum + item.quantity, 0) : 0,
      addToCart: cartEnabled ? addToCart : () => undefined,
    });
  }, [
    addToCart,
    cartEnabled,
    snapshot.lines,
    viewerId,
    pricingQuery.data,
    pricingQuery.isError,
    accessQuery.data,
  ]);
  return (
    <JwStoneMemberPricingContext.Provider value={value}>
      {children}
      {value.cartEnabled ? (
        <>
          <button
            type="button"
            style={JW_STONE_BRAND_STYLE}
            data-testid="jw-stone-member-cart-button"
            onClick={() => {
              onOpenCart?.();
              setCartOpen(true);
              void accessQuery.refetch();
            }}
            className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex min-h-12 items-center gap-2 border border-[var(--jw-border)] bg-[var(--jw-ink)] px-4 py-2 text-sm font-semibold text-white shadow-lg sm:right-6"
            aria-label={`Open JW Stone cart, ${value.cartCount} ${value.cartCount === 1 ? "slab" : "slabs"}`}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Cart
            {value.cartCount > 0 ? (
              <span className="inline-flex min-w-5 justify-center rounded-full bg-[var(--jw-accent)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--jw-on-accent)]">
                {value.cartCount}
              </span>
            ) : null}
          </button>
          {cartOpen ? (
            <JwStoneMemberCart
              key={viewerId}
              viewerId={viewerId}
              items={snapshot.lines}
              persisted={snapshot.persisted}
              notice={notice}
              onClose={closeCart}
              onQuantityChange={updateCartQuantity}
              onStockChange={updateCartStock}
            />
          ) : null}
        </>
      ) : null}
    </JwStoneMemberPricingContext.Provider>
  );
}

export function useJwStoneMemberCart() {
  return useContext(JwStoneMemberPricingContext);
}

export function useJwStoneMemberPrice(
  stoneName: string | null | undefined
): VisibleJwStonePrice | null {
  return useContext(JwStoneMemberPricingContext).priceFor(stoneName);
}
const USD_PER_SQUARE_FOOT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function formatCents(cents: number): string {
  return USD_PER_SQUARE_FOOT.format(cents / 100);
}
export type JwStoneSlabDimensionsInput = string | StoneInventoryDimensions | null | undefined;
export type JwStoneSlabCostEstimate = Readonly<{
  minimumTotalCents: number;
  maximumTotalCents: number;
}>;
function isValidSlabDimension(dimension: SlabDimension): boolean {
  return (
    Number.isFinite(dimension.widthIn) &&
    Number.isFinite(dimension.heightIn) &&
    dimension.widthIn >= 20 &&
    dimension.heightIn >= 20 &&
    dimension.widthIn <= 220 &&
    dimension.heightIn <= 220
  );
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
  if (
    typeof length !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(length) ||
    !Number.isFinite(height) ||
    length <= 0 ||
    height <= 0
  )
    return [];
  const unit = input.unit;
  if (unit !== "in" && unit !== "mm") return [];
  const inchesPerUnit = unit === "mm" ? 1 / 25.4 : 1;
  const dimension = { widthIn: length * inchesPerUnit, heightIn: height * inchesPerUnit };
  return isValidSlabDimension(dimension) ? [dimension] : [];
}
/** Estimate one slab from listed face dimensions; the cart obtains checked totals separately. */
export function estimateJwStoneSlabCost(
  slabPriceCents: number,
  dimensions: JwStoneSlabDimensionsInput
): JwStoneSlabCostEstimate | null {
  if (!isCents(slabPriceCents)) return null;
  const totals = slabDimensionsInInches(dimensions)
    .map(({ widthIn, heightIn }) => Math.round((widthIn * heightIn * slabPriceCents) / 144))
    .filter((total) => Number.isSafeInteger(total) && total > 0)
    .sort((a, b) => a - b);
  return totals.length
    ? { minimumTotalCents: totals[0], maximumTotalCents: totals[totals.length - 1] }
    : null;
}
function formatEstimatedSlabTotal(estimate: JwStoneSlabCostEstimate): string {
  const minimum = formatCents(estimate.minimumTotalCents);
  return estimate.maximumTotalCents === estimate.minimumTotalCents
    ? minimum
    : `${minimum}–${formatCents(estimate.maximumTotalCents)}`;
}
function cartItemId(stoneKey: string, dimensions: JwStoneSlabDimensionsInput): string {
  const dimensionKey =
    typeof dimensions === "string"
      ? dimensions.trim().slice(0, 240)
      : dimensions
        ? `${dimensions.length}x${dimensions.height}${dimensions.unit || "in"}`
        : "unsized";
  return `${stoneKey}:${dimensionKey}`;
}

export function JwStoneMemberPriceDisplay({
  stoneName,
  slabDimensions,
  inventoryPublicId,
  allowCatalogCart = true,
  presentation = "card",
}: {
  stoneName: string | null | undefined;
  slabDimensions?: JwStoneSlabDimensionsInput;
  inventoryPublicId?: string;
  allowCatalogCart?: boolean;
  presentation?: "card" | "detail" | "inventory";
}) {
  const context = useContext(JwStoneMemberPricingContext);
  const price = context.priceFor(stoneName);
  if (!price) return null;
  const internal = price.access === "internal";
  const compact = presentation !== "detail";
  const slabEstimate = estimateJwStoneSlabCost(price.slabPriceCents, slabDimensions);
  const stockId = jwStoneInventoryPublicIdSchema.safeParse(inventoryPublicId);
  return (
    <div
      data-testid={`jw-stone-member-price-${presentation}`}
      className={
        compact
          ? "mt-3 border-y border-[var(--jw-border)] py-2.5 text-center"
          : "mt-6 border-y border-[var(--jw-border)] py-4"
      }
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--jw-accent)]">
        {internal ? "JW Stone pricing" : "Business member pricing"}
      </p>
      <dl
        className={
          compact
            ? "mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs"
            : "mt-2 grid gap-2 text-sm sm:grid-cols-2"
        }
      >
        <div>
          <dt className="inline text-[var(--jw-muted)]">
            {price.bundleMinSlabs === 2 ? "1 slab " : "Slab "}
          </dt>
          <dd className="inline font-semibold text-[var(--jw-ink)]">
            {formatCents(price.slabPriceCents)} / sq. ft.
          </dd>
        </div>
        <div>
          <dt className="inline text-[var(--jw-muted)]">
            {price.bundleMinSlabs ? `${price.bundleMinSlabs}+ slabs ` : "Bundle "}
          </dt>
          <dd className="inline font-semibold text-[var(--jw-ink)]">
            {formatCents(price.bundlePriceCents)} / sq. ft.
          </dd>
        </div>
        {slabEstimate ? (
          <div
            className={
              compact ? "basis-full" : "border-t border-[var(--jw-border)] pt-2 sm:col-span-2"
            }
          >
            <dt className="inline text-[var(--jw-muted)]">Approx. slab total </dt>
            <dd
              className="inline font-semibold text-[var(--jw-ink)]"
              data-testid="jw-stone-estimated-slab-total"
            >
              {formatEstimatedSlabTotal(slabEstimate)}
              {compact ? null : (
                <span className="mt-1 block text-xs font-normal leading-5 text-[var(--jw-muted)]">
                  Based on the listed dimensions and slab rate. Confirm the exact slab size and
                  final price with JW Stone.
                </span>
              )}
            </dd>
          </div>
        ) : null}
        {internal && price.landedCostCents != null ? (
          <div className={compact ? "basis-full" : "sm:col-span-2"}>
            <dt className="inline text-[var(--jw-muted)]">Internal landed cost </dt>
            <dd className="inline font-semibold text-[var(--jw-ink)]">
              {formatCents(price.landedCostCents)} / sq. ft.
            </dd>
          </div>
        ) : null}
      </dl>
      {context.cartEnabled && (allowCatalogCart || stockId.success) ? (
        <button
          type="button"
          data-testid={`jw-stone-add-to-cart-${presentation}`}
          onClick={() =>
            context.addToCart({
              id: stockId.success
                ? `stock:${stockId.data}`
                : cartItemId(price.stoneKey, slabDimensions),
              stoneName: price.stoneName,
              stoneKey: price.stoneKey,
              ...(stockId.success ? { inventoryPublicId: stockId.data } : {}),
            })
          }
          className={
            compact
              ? "mt-2 inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--jw-border)] px-3 text-xs font-semibold text-[var(--jw-ink)] hover:bg-[var(--jw-bg)]"
              : "mt-4 inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--jw-ink)] px-4 py-2 text-sm font-semibold text-white"
          }
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          Add slab to cart
        </button>
      ) : null}
    </div>
  );
}
