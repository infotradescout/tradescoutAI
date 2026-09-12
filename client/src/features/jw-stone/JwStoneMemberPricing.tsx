import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import {
  JW_STONE_PRICING_PROFILE_SLUG,
  jwStonePriceKey,
  type JwStoneInternalPrice,
  type JwStoneMemberPrice,
  type JwStonePricingAccess,
  type JwStonePricingResponse,
} from "@shared/jwStoneMemberPricing";
import type { StoneInventoryDimensions } from "@shared/stoneInventory";
import { apiRequest } from "@/lib/queryClient";
import { parseSlabDimension, type SlabDimension } from "./slabDimensions";

type VisibleJwStonePrice = JwStoneMemberPrice &
  Readonly<{
    access: JwStonePricingAccess;
    landedCostCents?: number | null;
  }>;

type JwStoneCartItem = Readonly<{
  id: string;
  stoneName: string;
  stoneKey: string;
  quantity: number;
  slabRateCents: number;
  minimumTotalCents: number | null;
  maximumTotalCents: number | null;
}>;

type JwStoneCartDraft = Omit<JwStoneCartItem, "quantity">;

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
const JW_STONE_CART_STORAGE_PREFIX = "tradescout:jw-stone:member-cart:v1:";

function isCents(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 10_000_000;
}

function isCartItem(value: unknown): value is JwStoneCartItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    item.id.length <= 500 &&
    typeof item.stoneName === "string" &&
    item.stoneName.trim().length > 0 &&
    typeof item.stoneKey === "string" &&
    item.stoneKey === jwStonePriceKey(item.stoneName) &&
    Number.isInteger(item.quantity) &&
    Number(item.quantity) >= 1 &&
    Number(item.quantity) <= 999 &&
    isCents(item.slabRateCents) &&
    (item.minimumTotalCents === null || isCents(item.minimumTotalCents)) &&
    (item.maximumTotalCents === null || isCents(item.maximumTotalCents)) &&
    (item.minimumTotalCents === null ||
      item.maximumTotalCents === null ||
      Number(item.maximumTotalCents) >= Number(item.minimumTotalCents))
  );
}

function readMemberCart(viewerId: string): readonly JwStoneCartItem[] {
  if (typeof window === "undefined" || !viewerId) return [];
  try {
    const raw = window.localStorage.getItem(`${JW_STONE_CART_STORAGE_PREFIX}${viewerId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 100) return [];
    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

function writeMemberCart(viewerId: string, items: readonly JwStoneCartItem[]): void {
  if (typeof window === "undefined" || !viewerId) return;
  try {
    window.localStorage.setItem(
      `${JW_STONE_CART_STORAGE_PREFIX}${viewerId}`,
      JSON.stringify(items.slice(0, 100))
    );
  } catch {
    // Cart persistence is helpful, but storage failure must not break shopping.
  }
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
  ) {
    return null;
  }

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
    ) {
      return null;
    }
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
}: {
  children: ReactNode;
  viewerId: string | null;
}) {
  const normalizedViewerId = String(viewerId || "").trim();
  const pricingQuery = useQuery({
    queryKey: ["jw-stone", "member-pricing", normalizedViewerId],
    queryFn: async () =>
      sanitizeJwStonePricingResponse(
        await apiRequest("GET", "/api/u/jw-stone/member-pricing"),
        normalizedViewerId
      ),
    enabled: Boolean(normalizedViewerId),
    retry: false,
    staleTime: 4 * 60 * 1000,
    gcTime: 0,
    refetchOnWindowFocus: "always",
  });
  const [cart, setCart] = useState<readonly JwStoneCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loadedCartViewer, setLoadedCartViewer] = useState<string | null>(null);

  useEffect(() => {
    setCart(normalizedViewerId ? readMemberCart(normalizedViewerId) : []);
    setLoadedCartViewer(normalizedViewerId || null);
    setCartOpen(false);
  }, [normalizedViewerId]);

  useEffect(() => {
    if (!normalizedViewerId || loadedCartViewer !== normalizedViewerId) return;
    writeMemberCart(normalizedViewerId, cart);
  }, [cart, loadedCartViewer, normalizedViewerId]);

  const addToCart = useCallback((item: JwStoneCartDraft) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.id === item.id
            ? { ...entry, quantity: Math.min(999, entry.quantity + 1) }
            : entry
        );
      }
      return [...current, { ...item, quantity: 1 }].slice(0, 100);
    });
    setCartOpen(true);
  }, []);

  const updateCartQuantity = useCallback((id: string, quantity: number) => {
    setCart((current) =>
      quantity <= 0
        ? current.filter((item) => item.id !== id)
        : current.map((item) =>
            item.id === id ? { ...item, quantity: Math.min(999, quantity) } : item
          )
    );
  }, []);

  const value = useMemo<JwStoneMemberPricingContextValue>(() => {
    const response = pricingQuery.data;
    if (
      !normalizedViewerId ||
      pricingQuery.isError ||
      !response ||
      response.viewerId !== normalizedViewerId
    ) {
      return EMPTY_CONTEXT;
    }
    const priceMap = new Map<string, VisibleJwStonePrice>(
      response.prices.map((price): [string, VisibleJwStonePrice] => [
        price.stoneKey,
        Object.freeze({
          ...price,
          access: response.access,
        }) as VisibleJwStonePrice,
      ])
    );
    return Object.freeze({
      access: response.access,
      priceFor: (stoneName: string | null | undefined) =>
        priceMap.get(jwStonePriceKey(stoneName)) || null,
      cartEnabled: response.access === "member",
      cartCount: response.access === "member" ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0,
      addToCart: response.access === "member" ? addToCart : () => undefined,
    });
  }, [addToCart, cart, normalizedViewerId, pricingQuery.data, pricingQuery.isError]);

  const cartEnabled = value.cartEnabled;
  const totals = useMemo(() => {
    let minimum = 0;
    let maximum = 0;
    let pricedItems = 0;
    for (const item of cart) {
      if (item.minimumTotalCents == null || item.maximumTotalCents == null) continue;
      minimum += item.minimumTotalCents * item.quantity;
      maximum += item.maximumTotalCents * item.quantity;
      pricedItems += item.quantity;
    }
    return { minimum, maximum, pricedItems };
  }, [cart]);

  return (
    <JwStoneMemberPricingContext.Provider value={value}>
      {children}
      {cartEnabled ? (
        <>
          <button
            type="button"
            data-testid="jw-stone-member-cart-button"
            onClick={() => setCartOpen(true)}
            className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 inline-flex min-h-12 items-center gap-2 border border-[var(--jw-border)] bg-[var(--jw-ink)] px-4 py-2 text-sm font-semibold text-white shadow-lg sm:bottom-6 sm:right-6"
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
            <div
              className="fixed inset-0 z-[70] flex justify-end bg-black/35"
              role="presentation"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setCartOpen(false);
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-label="JW Stone cart"
                data-testid="jw-stone-member-cart"
                className="flex h-full w-full max-w-md flex-col bg-[var(--jw-surface)] shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-[var(--jw-border)] px-5 py-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--jw-accent)]">
                      JW Stone business member
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-[var(--jw-ink)]">Slab cart</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCartOpen(false)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--jw-ink)]"
                    aria-label="Close cart"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {cart.length === 0 ? (
                    <div className="border border-dashed border-[var(--jw-border)] p-6 text-center">
                      <ShoppingCart className="mx-auto h-6 w-6 text-[var(--jw-muted)]" aria-hidden="true" />
                      <p className="mt-3 font-semibold text-[var(--jw-ink)]">Your cart is empty</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--jw-muted)]">
                        Add a priced slab to start an order.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((item) => {
                        const itemMinimum =
                          item.minimumTotalCents == null
                            ? null
                            : item.minimumTotalCents * item.quantity;
                        const itemMaximum =
                          item.maximumTotalCents == null
                            ? null
                            : item.maximumTotalCents * item.quantity;
                        return (
                          <article
                            key={item.id}
                            className="border border-[var(--jw-border)] bg-white p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-[var(--jw-ink)]">{item.stoneName}</h3>
                                <p className="mt-1 text-xs text-[var(--jw-muted)]">
                                  {formatCents(item.slabRateCents)} / sq. ft.
                                </p>
                                {itemMinimum != null && itemMaximum != null ? (
                                  <p className="mt-1 text-sm font-semibold text-[var(--jw-ink)]">
                                    {formatEstimatedSlabTotal({
                                      minimumTotalCents: itemMinimum,
                                      maximumTotalCents: itemMaximum,
                                    })}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-xs text-[var(--jw-muted)]">
                                    Final total needs exact slab dimensions.
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.id, 0)}
                                className="inline-flex min-h-10 min-w-10 items-center justify-center text-[var(--jw-muted)] hover:text-[var(--jw-ink)]"
                                aria-label={`Remove ${item.stoneName} from cart`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                            <div className="mt-3 inline-flex items-center border border-[var(--jw-border)]">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                className="inline-flex min-h-10 min-w-10 items-center justify-center"
                                aria-label={`Decrease ${item.stoneName} quantity`}
                              >
                                <Minus className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <span className="min-w-10 text-center text-sm font-semibold" aria-label="Quantity">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                className="inline-flex min-h-10 min-w-10 items-center justify-center"
                                aria-label={`Increase ${item.stoneName} quantity`}
                              >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--jw-border)] px-5 py-4">
                  {totals.pricedItems > 0 ? (
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <span className="text-[var(--jw-muted)]">Estimated material subtotal</span>
                      <strong className="text-right text-[var(--jw-ink)]">
                        {formatEstimatedSlabTotal({
                          minimumTotalCents: totals.minimum,
                          maximumTotalCents: totals.maximum,
                        })}
                      </strong>
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs leading-5 text-[var(--jw-muted)]">
                    Delivery, tax, exact slab measurements, and final availability are confirmed before checkout.
                  </p>
                  <button
                    type="button"
                    disabled={cart.length === 0}
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center bg-[var(--jw-accent)] px-4 py-3 text-sm font-semibold text-[var(--jw-on-accent)] disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => setCartOpen(false)}
                  >
                    Continue shopping
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </JwStoneMemberPricingContext.Provider>
  );
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
  ) {
    return [];
  }

  const unit = input.unit || "in";
  if (unit !== "in" && unit !== "mm") return [];
  const inchesPerUnit = unit === "mm" ? 1 / 25.4 : 1;
  const dimension = {
    widthIn: length * inchesPerUnit,
    heightIn: height * inchesPerUnit,
  };
  return isValidSlabDimension(dimension) ? [dimension] : [];
}

/**
 * Estimate the material total for one slab from its listed face dimensions.
 * The result uses the single-slab rate, not the bundle or internal landed rate.
 */
export function estimateJwStoneSlabCost(
  slabPriceCents: number,
  dimensions: JwStoneSlabDimensionsInput
): JwStoneSlabCostEstimate | null {
  if (!isCents(slabPriceCents)) return null;

  const totals = slabDimensionsInInches(dimensions)
    .map(({ widthIn, heightIn }) => Math.round((widthIn * heightIn * slabPriceCents) / 144))
    .filter((total) => Number.isSafeInteger(total) && total > 0)
    .sort((a, b) => a - b);
  if (!totals.length) return null;

  return {
    minimumTotalCents: totals[0],
    maximumTotalCents: totals[totals.length - 1],
  };
}

function formatEstimatedSlabTotal(estimate: JwStoneSlabCostEstimate): string {
  const minimum = formatCents(estimate.minimumTotalCents);
  return estimate.maximumTotalCents === estimate.minimumTotalCents
    ? minimum
    : `${minimum}–${formatCents(estimate.maximumTotalCents)}`;
}

function cartItemId(
  stoneKey: string,
  dimensions: JwStoneSlabDimensionsInput,
  estimate: JwStoneSlabCostEstimate | null
): string {
  const dimensionKey =
    typeof dimensions === "string"
      ? dimensions.trim().slice(0, 240)
      : dimensions
        ? `${dimensions.length}x${dimensions.height}${dimensions.unit || "in"}`
        : estimate
          ? `${estimate.minimumTotalCents}-${estimate.maximumTotalCents}`
          : "unsized";
  return `${stoneKey}:${dimensionKey}`;
}

export function JwStoneMemberPriceDisplay({
  stoneName,
  slabDimensions,
  presentation = "card",
}: {
  stoneName: string | null | undefined;
  slabDimensions?: JwStoneSlabDimensionsInput;
  presentation?: "card" | "detail" | "inventory";
}) {
  const context = useContext(JwStoneMemberPricingContext);
  const price = context.priceFor(stoneName);
  if (!price) return null;
  const internal = price.access === "internal";
  const compact = presentation !== "detail";
  const slabEstimate = estimateJwStoneSlabCost(price.slabPriceCents, slabDimensions);

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
      {context.cartEnabled ? (
        <button
          type="button"
          data-testid={`jw-stone-add-to-cart-${presentation}`}
          onClick={() =>
            context.addToCart({
              id: cartItemId(price.stoneKey, slabDimensions, slabEstimate),
              stoneName: price.stoneName,
              stoneKey: price.stoneKey,
              slabRateCents: price.slabPriceCents,
              minimumTotalCents: slabEstimate?.minimumTotalCents ?? null,
              maximumTotalCents: slabEstimate?.maximumTotalCents ?? null,
            })
          }
          className={
            compact
              ? "mt-2 inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--jw-border)] px-3 text-xs font-semibold text-[var(--jw-ink)] hover:bg-[var(--jw-bg)]"
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
