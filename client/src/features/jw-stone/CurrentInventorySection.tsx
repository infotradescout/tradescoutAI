import { useQuery } from "@tanstack/react-query";
import { Clock3, MessageCircle, PackageCheck, RefreshCw } from "lucide-react";
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
  return `Confirmed ${parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

type Props = {
  onAsk: (item: PublicStoneInventoryItem) => void;
  onStartRequest: () => void;
};

export function CurrentInventorySection({ onAsk, onStartRequest }: Props) {
  const inventoryQuery = useQuery({
    queryKey: ["jw-stone", "current-inventory"],
    queryFn: () =>
      apiRequest("GET", "/api/u/jw-stone/stone-inventory/current") as Promise<PublicStoneInventoryResponse>,
    staleTime: 30_000,
  });
  const items = inventoryQuery.data?.items ?? [];

  return (
    <section
      id="current-inventory"
      data-testid="jw-current-inventory"
      aria-labelledby="jw-current-inventory-heading"
      className={`border-y border-[var(--jw-border)] bg-[var(--jw-surface)] ${jw.scrollTarget}`}
    >
      <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-9 sm:py-10 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--jw-accent)]">
              Seller-published physical stock
            </p>
            <h2
              id="jw-current-inventory-heading"
              className="mt-2 font-editorial text-3xl tracking-tight text-[var(--jw-ink)] sm:text-4xl"
            >
              Current Inventory
            </h2>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${jw.muted}`}>
              Only physical lots explicitly marked sale-ready inside their active confirmation
              window appear here. The Material Library below is broader reference material and
              does not claim that a physical item is on hand.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void inventoryQuery.refetch()}
            disabled={inventoryQuery.isFetching}
            className={`inline-flex min-h-11 items-center gap-2 px-3 text-sm ${jw.ghostOnLight}`}
          >
            <RefreshCw
              className={`h-4 w-4 ${inventoryQuery.isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        {inventoryQuery.isLoading ? (
          <div className="mt-7 flex min-h-32 items-center justify-center" aria-live="polite">
            <p className={`text-sm ${jw.muted}`}>Checking seller-published stock…</p>
          </div>
        ) : inventoryQuery.isError ? (
          <InventoryNotice
            title="Current stock could not be loaded."
            body="The Material Library is still available. Start a Request and JW Stone can confirm the exact material, quantity, and timing."
            onStartRequest={onStartRequest}
          />
        ) : items.length ? (
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
                  data-testid={`jw-current-inventory-item-${item.id}`}
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
                      <PackageCheck
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
                      Ask about this stock
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <InventoryNotice
            title="No physical lots are seller-published right now."
            body="Browse the Material Library for stone ideas. JW Stone confirms the exact lot, quantity, dimensions, finish, location, and timing before publishing it here."
            onStartRequest={onStartRequest}
          />
        )}
      </div>
    </section>
  );
}

function InventoryNotice({
  title,
  body,
  onStartRequest,
}: {
  title: string;
  body: string;
  onStartRequest: () => void;
}) {
  return (
    <div className="mt-7 border border-[var(--jw-border)] bg-[var(--jw-bg)] p-5 sm:p-6">
      <p className="font-semibold text-[var(--jw-ink)]">{title}</p>
      <p className={`mt-2 max-w-2xl text-sm leading-6 ${jw.muted}`}>{body}</p>
      <button
        type="button"
        onClick={onStartRequest}
        className={`mt-4 inline-flex min-h-11 items-center gap-2 px-4 text-sm ${jw.accentCta}`}
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Start a Request
      </button>
    </div>
  );
}
