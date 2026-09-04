import { useQuery } from "@tanstack/react-query";
import { Clock3, MessageCircle, Sparkles } from "lucide-react";
import type {
  PublicStoneInventoryItem,
  PublicStoneInventoryResponse,
  StoneInventoryDimensions,
} from "@shared/stoneInventory";
import { apiRequest } from "@/lib/queryClient";
import { jw } from "./brand";

function formatDimensions(dimensions: StoneInventoryDimensions | null): string | null {
  if (!dimensions) return null;
  const values = [dimensions.length, dimensions.height, dimensions.thickness].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0
  );
  return values.length ? `${values.join(" × ")} ${dimensions.unit || "in"}` : null;
}

function formatConfirmedDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently confirmed";
  return `Stock confirmed ${parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

type Props = {
  onAsk: (item: PublicStoneInventoryItem) => void;
};

/**
 * Inventory truth boundary: Only physical lots explicitly marked sale-ready
 * may qualify, and they still require a separate New Arrivals choice. The
 * Browse Full Inventory does not claim that a physical item is on hand.
 */
export function NewArrivalsSection({ onAsk }: Props) {
  const arrivalsQuery = useQuery({
    queryKey: ["jw-stone", "new-arrivals"],
    queryFn: () =>
      apiRequest(
        "GET",
        "/api/u/jw-stone/stone-inventory/new-arrivals"
      ) as Promise<PublicStoneInventoryResponse>,
    staleTime: 30_000,
  });
  const items = arrivalsQuery.data?.items ?? [];

  if (arrivalsQuery.isLoading || arrivalsQuery.isError || items.length === 0) return null;

  return (
    <section
      id="new-arrivals"
      data-testid="jw-new-arrivals"
      aria-labelledby="jw-new-arrivals-heading"
      className={`border-y border-[var(--jw-border)] bg-[var(--jw-surface)] ${jw.scrollTarget}`}
    >
      <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-9 sm:py-10 lg:px-12">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--jw-accent)]">
            Just arrived
          </p>
          <h2
            id="jw-new-arrivals-heading"
            className="mt-2 font-editorial text-3xl tracking-tight text-[var(--jw-ink)] sm:text-4xl"
          >
            New Arrivals
          </h2>
          <p className={`mt-2 max-w-2xl text-sm leading-6 ${jw.muted}`}>
            Newly received physical lots selected by JW Stone. Ask about the exact lot, quantity,
            finish, and timing.
          </p>
        </header>

        <ul className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const dimensions = formatDimensions(item.dimensions);
            const image = item.imageUrls[0] || null;
            const finishSummary = item.finishQuantities
              .map((finish) => `${finish.slabCount} ${finish.finish}`)
              .join(" · ");
            return (
              <li
                key={item.id}
                className="overflow-hidden border border-[var(--jw-border)] bg-[var(--jw-bg)]"
                data-testid={`jw-new-arrival-item-${item.id}`}
              >
                {image ? (
                  <div className="aspect-[4/3] overflow-hidden bg-[var(--jw-dark)]">
                    <img
                      src={image}
                      alt={`${item.materialName} ${item.assetKind.replace(/_/g, " ")}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : null}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-editorial text-2xl text-[var(--jw-ink)]">
                        {item.materialName}
                      </h3>
                      {item.materialFamily ? (
                        <p className={`mt-1 text-xs uppercase tracking-[0.14em] ${jw.muted}`}>
                          {item.materialFamily}
                        </p>
                      ) : null}
                    </div>
                    <Sparkles
                      className="h-5 w-5 shrink-0 text-[var(--jw-accent)]"
                      aria-hidden="true"
                    />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className={jw.muted}>Quantity</dt>
                      <dd className="font-semibold text-[var(--jw-ink)]">
                        {item.quantity} {item.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className={jw.muted}>Type</dt>
                      <dd className="font-semibold capitalize text-[var(--jw-ink)]">
                        {item.assetKind.replace(/_/g, " ")}
                      </dd>
                    </div>
                    {dimensions ? (
                      <div>
                        <dt className={jw.muted}>Dimensions</dt>
                        <dd className="font-semibold text-[var(--jw-ink)]">{dimensions}</dd>
                      </div>
                    ) : null}
                    {finishSummary ? (
                      <div>
                        <dt className={jw.muted}>Known finish</dt>
                        <dd className="font-semibold text-[var(--jw-ink)]">{finishSummary}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className={`mt-4 inline-flex items-center gap-1.5 text-xs ${jw.muted}`}>
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatConfirmedDate(item.lastConfirmedAt)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onAsk(item)}
                    className={`mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-sm ${jw.accentCta}`}
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Ask about this arrival
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
