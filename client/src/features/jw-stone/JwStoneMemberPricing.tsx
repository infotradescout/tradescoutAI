import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { JW_STONE_PRICING_PROFILE_SLUG, jwStonePriceKey, type JwStoneInternalPrice, type JwStoneMemberPrice, type JwStonePricingAccess, type JwStonePricingResponse } from "@shared/jwStoneMemberPricing";
import type { StoneInventoryDimensions } from "@shared/stoneInventory";
import { apiRequest } from "@/lib/queryClient";
import { parseSlabDimension, type SlabDimension } from "./slabDimensions";
import { JwStoneCartProvider, useJwStoneCart } from "./JwStoneCart";

type VisibleJwStonePrice = JwStoneMemberPrice & Readonly<{ access: JwStonePricingAccess; landedCostCents?: number | null }>;
const EMPTY = { priceFor: (_name: string | null | undefined): VisibleJwStonePrice | null => null };
const JwStoneMemberPricingContext = createContext(EMPTY);
function isCents(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 10_000_000;
}
export function sanitizeJwStonePricingResponse(value: unknown, viewerId: string): JwStonePricingResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.profileSlug !== JW_STONE_PRICING_PROFILE_SLUG || record.viewerId !== viewerId || record.currency !== "USD" || record.unit !== "square_foot" || (record.access !== "member" && record.access !== "internal") || typeof record.sourceUpdatedAt !== "string" || Number.isNaN(new Date(record.sourceUpdatedAt).getTime()) || !Array.isArray(record.prices) || record.prices.length > 500) return null;
  const access = record.access;
  const seen = new Set<string>();
  const prices: Array<JwStoneMemberPrice | JwStoneInternalPrice> = [];
  for (const rawPrice of record.prices) {
    if (!rawPrice || typeof rawPrice !== "object" || Array.isArray(rawPrice)) return null;
    const price = rawPrice as Record<string, unknown>;
    const stoneName = typeof price.stoneName === "string" ? price.stoneName.trim() : "";
    const stoneKey = typeof price.stoneKey === "string" ? price.stoneKey.trim() : "";
    if (!stoneName || !stoneKey || stoneKey !== jwStonePriceKey(stoneName) || seen.has(stoneKey) || !isCents(price.slabPriceCents) || !isCents(price.bundlePriceCents)) return null;
    if (price.bundleMinSlabs !== undefined && (!Number.isInteger(price.bundleMinSlabs) || Number(price.bundleMinSlabs) < 2 || Number(price.bundleMinSlabs) > 999)) return null;
    seen.add(stoneKey);
    const memberPrice = { stoneName, stoneKey, slabPriceCents: price.slabPriceCents, bundlePriceCents: price.bundlePriceCents, ...(price.bundleMinSlabs === undefined ? {} : { bundleMinSlabs: price.bundleMinSlabs as number }) };
    if (access === "internal") {
      if (price.landedCostCents !== null && !isCents(price.landedCostCents) && price.landedCostCents !== 0) return null;
      prices.push({ ...memberPrice, landedCostCents: price.landedCostCents as number | null });
    } else prices.push(memberPrice);
  }
  return { profileSlug: JW_STONE_PRICING_PROFILE_SLUG, viewerId, currency: "USD", unit: "square_foot", sourceUpdatedAt: new Date(record.sourceUpdatedAt).toISOString(), access, prices } as JwStonePricingResponse;
}
export function JwStoneMemberPricingProvider({ children, viewerId }: { children: ReactNode; viewerId: string | null }) {
  const normalizedViewerId = String(viewerId || "").trim();
  const pricingQuery = useQuery({ queryKey: ["jw-stone", "member-pricing", normalizedViewerId], queryFn: async () => sanitizeJwStonePricingResponse(await apiRequest("GET", "/api/u/jw-stone/member-pricing"), normalizedViewerId), enabled: Boolean(normalizedViewerId), retry: false, staleTime: 4 * 60 * 1000, gcTime: 0, refetchOnWindowFocus: "always" });
  const value = useMemo(() => {
    const response = pricingQuery.data;
    if (!normalizedViewerId || pricingQuery.isError || !response || response.viewerId !== normalizedViewerId) return EMPTY;
    const priceMap = new Map<string, VisibleJwStonePrice>(response.prices.map(price => [price.stoneKey, { ...price, access: response.access }]));
    return { priceFor: (name: string | null | undefined) => priceMap.get(jwStonePriceKey(name)) || null };
  }, [normalizedViewerId, pricingQuery.data, pricingQuery.isError]);
  return <JwStoneCartProvider viewerId={normalizedViewerId || null}><JwStoneMemberPricingContext.Provider value={value}>{children}</JwStoneMemberPricingContext.Provider></JwStoneCartProvider>;
}
export function useJwStoneMemberPrice(stoneName: string | null | undefined): VisibleJwStonePrice | null {
  return useContext(JwStoneMemberPricingContext).priceFor(stoneName);
}
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatCents = (cents: number) => USD.format(cents / 100);
export type JwStoneSlabDimensionsInput = string | StoneInventoryDimensions | null | undefined;
export type JwStoneSlabCostEstimate = Readonly<{ minimumTotalCents: number; maximumTotalCents: number }>;
function isValidSlabDimension(dimension: SlabDimension): boolean {
  return Number.isFinite(dimension.widthIn) && Number.isFinite(dimension.heightIn) && dimension.widthIn >= 20 && dimension.heightIn >= 20 && dimension.widthIn <= 220 && dimension.heightIn <= 220;
}
function slabDimensionsInInches(input: JwStoneSlabDimensionsInput): readonly SlabDimension[] {
  if (!input) return [];
  if (typeof input === "string") {
    const unique = new Map<string, SlabDimension>();
    for (const label of input.split(/\s*·\s*/).slice(0, 4)) {
      const dimension = parseSlabDimension(label);
      if (dimension && isValidSlabDimension(dimension)) unique.set(`${dimension.widthIn}x${dimension.heightIn}`, dimension);
    }
    return [...unique.values()];
  }
  const length = input.length, height = input.height;
  if (typeof length !== "number" || typeof height !== "number" || !Number.isFinite(length) || !Number.isFinite(height) || length <= 0 || height <= 0 || (input.unit !== "in" && input.unit !== "mm")) return [];
  const scale = input.unit === "mm" ? 1 / 25.4 : 1;
  const dimension = { widthIn: length * scale, heightIn: height * scale };
  return isValidSlabDimension(dimension) ? [dimension] : [];
}
export function estimateJwStoneSlabCost(slabPriceCents: number, dimensions: JwStoneSlabDimensionsInput): JwStoneSlabCostEstimate | null {
  if (!isCents(slabPriceCents)) return null;
  const totals = slabDimensionsInInches(dimensions).map(({ widthIn, heightIn }) => Math.round(widthIn * heightIn * slabPriceCents / 144)).filter(total => Number.isSafeInteger(total) && total > 0).sort((a, b) => a - b);
  return totals.length ? { minimumTotalCents: totals[0], maximumTotalCents: totals[totals.length - 1] } : null;
}
function formatEstimatedSlabTotal(estimate: JwStoneSlabCostEstimate): string {
  return estimate.minimumTotalCents === estimate.maximumTotalCents ? formatCents(estimate.minimumTotalCents) : `${formatCents(estimate.minimumTotalCents)}–${formatCents(estimate.maximumTotalCents)}`;
}
export function JwStoneMemberPriceDisplay({ stoneName, slabDimensions, presentation = "card", allowCatalogCart = true }: { stoneName: string | null | undefined; slabDimensions?: JwStoneSlabDimensionsInput; presentation?: "card" | "detail" | "inventory"; allowCatalogCart?: boolean }) {
  const context = useContext(JwStoneMemberPricingContext);
  const cart = useJwStoneCart();
  const price = context.priceFor(stoneName);
  if (!price) return null;
  const internal = price.access === "internal";
  const compact = presentation !== "detail";
  const estimate = estimateJwStoneSlabCost(price.slabPriceCents, slabDimensions);
  const dimensionKey = typeof slabDimensions === "string" ? slabDimensions.trim().slice(0, 240) : slabDimensions ? `${slabDimensions.length}x${slabDimensions.height}${slabDimensions.unit || "unknown"}` : "unsized";
  return <div data-testid={`jw-stone-member-price-${presentation}`} className={compact ? "mt-3 border-y border-[var(--jw-border)] py-2.5 text-center" : "mt-6 border-y border-[var(--jw-border)] py-4"}>
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--jw-accent)]">{internal ? "JW Stone pricing" : "Business member pricing"}</p>
    <dl className={compact ? "mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs" : "mt-2 grid gap-2 text-sm sm:grid-cols-2"}>
      <div><dt className="inline text-[var(--jw-muted)]">{price.bundleMinSlabs === 2 ? "1 slab " : "Slab "}</dt><dd className="inline font-semibold text-[var(--jw-ink)]">{formatCents(price.slabPriceCents)} / sq. ft.</dd></div>
      <div><dt className="inline text-[var(--jw-muted)]">{price.bundleMinSlabs ? `${price.bundleMinSlabs}+ slabs ` : "Bundle "}</dt><dd className="inline font-semibold text-[var(--jw-ink)]">{formatCents(price.bundlePriceCents)} / sq. ft.</dd></div>
      {estimate ? <div className={compact ? "basis-full" : "border-t border-[var(--jw-border)] pt-2 sm:col-span-2"}><dt className="inline text-[var(--jw-muted)]">Approx. slab total </dt><dd data-testid="jw-stone-estimated-slab-total" className="inline font-semibold text-[var(--jw-ink)]">{formatEstimatedSlabTotal(estimate)}{!compact ? <span className="mt-1 block text-xs font-normal leading-5 text-[var(--jw-muted)]">Based on listed dimensions. Select an actual inventory lot for a current cart review.</span> : null}</dd></div> : null}
      {internal && price.landedCostCents != null ? <div className={compact ? "basis-full" : "sm:col-span-2"}><dt className="inline text-[var(--jw-muted)]">Internal landed cost </dt><dd className="inline font-semibold text-[var(--jw-ink)]">{formatCents(price.landedCostCents)} / sq. ft.</dd></div> : null}
    </dl>
    {cart.enabled && allowCatalogCart ? <button type="button" data-testid={`jw-stone-add-to-cart-${presentation}`} onClick={() => cart.add({ id: `${price.stoneKey}:${dimensionKey}`, kind: "catalog", stoneName: price.stoneName })} className={compact ? "mt-2 inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--jw-border)] px-3 text-xs font-semibold text-[var(--jw-ink)]" : "mt-4 inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--jw-ink)] px-4 py-2 text-sm font-semibold text-white"}><ShoppingCart className="h-4 w-4" />Add selection to cart</button> : null}
  </div>;
}
