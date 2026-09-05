import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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

type JwStoneMemberPricingContextValue = Readonly<{
  access: JwStonePricingAccess | null;
  priceFor: (stoneName: string | null | undefined) => VisibleJwStonePrice | null;
}>;

const EMPTY_CONTEXT: JwStoneMemberPricingContextValue = Object.freeze({
  access: null,
  priceFor: () => null,
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
    seen.add(stoneKey);
    const memberPrice = {
      stoneName,
      stoneKey,
      slabPriceCents: price.slabPriceCents,
      bundlePriceCents: price.bundlePriceCents,
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
    refetchOnWindowFocus: false,
  });

  const value = useMemo<JwStoneMemberPricingContextValue>(() => {
    const response = pricingQuery.data;
    if (!normalizedViewerId || !response || response.viewerId !== normalizedViewerId) {
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
    });
  }, [normalizedViewerId, pricingQuery.data]);

  return (
    <JwStoneMemberPricingContext.Provider value={value}>
      {children}
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

export type JwStoneSlabDimensionsInput =
  | string
  | StoneInventoryDimensions
  | null
  | undefined;

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

export function JwStoneMemberPriceDisplay({
  stoneName,
  slabDimensions,
  presentation = "card",
}: {
  stoneName: string | null | undefined;
  slabDimensions?: JwStoneSlabDimensionsInput;
  presentation?: "card" | "detail" | "inventory";
}) {
  const price = useJwStoneMemberPrice(stoneName);
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
          <dt className="inline text-[var(--jw-muted)]">Slab </dt>
          <dd className="inline font-semibold text-[var(--jw-ink)]">
            {formatCents(price.slabPriceCents)} / sq. ft.
          </dd>
        </div>
        <div>
          <dt className="inline text-[var(--jw-muted)]">Bundle </dt>
          <dd className="inline font-semibold text-[var(--jw-ink)]">
            {formatCents(price.bundlePriceCents)} / sq. ft.
          </dd>
        </div>
        {slabEstimate ? (
          <div className={compact ? "basis-full" : "border-t border-[var(--jw-border)] pt-2 sm:col-span-2"}>
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
    </div>
  );
}
