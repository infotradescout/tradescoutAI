import { useCallback, useEffect, useState } from "react";
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
  const values = [dimensions.width, dimensions.height, dimensions.thickness].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0
  );
  if (!values.length) return null;
  return `${values.join(" × ")} ${dimensions.unit || "in"}`;
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

type CurrentInventorySectionProps = {
  onAsk: (item: PublicStoneInventoryItem) => void;
  onStartRequest: () => void;
};

export function CurrentInventorySection({
  onAsk,
  onStartRequest,
}: CurrentInventorySectionProps) {
  const [response, setResponse] = useState<PublicStoneInventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const next = (await apiRequest(
        "GET",
        "/api/u/jw-stone/stone-inventory/current"
      )) as PublicStoneInventoryResponse;
      setResponse(next);
    } catch {
      setFailed(true);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = response?.items || [];

  return (
    <section
      id="current-inventory"
      data-testid="jw-current-inventory"
      aria-labelledby="jw-current-inventory-heading"
      className="border-y border-[var(--jw-border)] bg-[var(--jw-surface)]"
    >
      <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-9 sm:py-10 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--jw-accent)]">
              Physically confirmed stock
            </p>
            <h2
              id="jw-current-inventory-heading"
              className="mt-2 font-editorial text-3xl tracking-tight text-[var(--jw-ink)] sm:text-4xl"
            >
              Current Inventory
            </h2>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${jw.muted}`}>
              Only slabs, bundles, blocks, containers, or A-frames confirmed inside their
              active recheck window appear here. The Material Library below is broader and
              does not claim that a physical item is currently on hand.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={`inline-flex min-h-11 items-center gap-2 px-3 text-sm ${jw.ghostOnLight}`}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-7 flex min-h-32 items-center justify-center" aria-live="polite">
            <p className={`text-sm ${jw.muted}`}>Checking recently confirmed stock…</p>
          </div>
        ) : failed ? (
          <div className="mt-7 border border-[var(--jw-border)] bg-[var(--jw-bg)] p-5">
            <p className="font-semibold text-[var(--jw-ink)]">Current stock could not be loaded.</p>
            <p className={`mt-2 text-sm ${jw.muted}`}>
              The Material Library is still available. Start a Request and JW Stone can confirm
              the exact material, quantity, and timing.
            </p>
            <button
              type="button"
              onClick={onStartRequest}
              className={`mt-4 inline-flex min-h-11 items-center gap-2 px-4 text-sm ${jw.accentCta}`}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Start a Request
            </button>
          </div>
        ) : items.length ? (
          <ul className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const dimensions = formatDimensions(item.dimensions);
              const image = item.imageUrls[0] || null;
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
                        <p className={`mt-1 text-xs uppercase tracking-[0.14em] ${jw.muted}`}>
                          {item.sourceAssetRef}
                        </p>
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
                      {item.finish ? (
                        <div>
                          <dt className={jw.muted}>Finish</dt>
                          <dd className="font-semibold text-[var(--jw-ink)]">{item.finish}</dd>
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
          <div className="mt-7 border border-[var(--jw-border)] bg-[var(--jw-bg)] p-5 sm:p-6">
            <p className="font-semibold text-[var(--jw-ink)]">
              No physical stock has been confirmed recently enough to publish.
            </p>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${jw.muted}`}>
              Browse the Material Library for stone ideas, then Start a Request. JW Stone will
              confirm the exact item, quantity, dimensions, finish, location, and timing before
              treating it as available.
            </p>
            <button
              type="button"
              onClick={onStartRequest}
              className={`mt-4 inline-flex min-h-11 items-center gap-2 px-4 text-sm ${jw.accentCta}`}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Start a Request
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
