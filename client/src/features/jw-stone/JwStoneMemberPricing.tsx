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
import { apiRequest } from "@/lib/queryClient";

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

export function JwStoneMemberPriceDisplay({
  stoneName,
  presentation = "card",
}: {
  stoneName: string | null | undefined;
  presentation?: "card" | "detail" | "inventory";
}) {
  const price = useJwStoneMemberPrice(stoneName);
  if (!price) return null;
  const internal = price.access === "internal";
  const compact = presentation !== "detail";

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
