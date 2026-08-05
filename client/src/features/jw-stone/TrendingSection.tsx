import { MessageCircle } from "lucide-react";
import { jw } from "./brand";
import { StonePalette } from "./StonePalette";
import type { JwStoneCatalogItem } from "./types";

type TrendingSectionProps = {
  items: readonly JwStoneCatalogItem[];
  onOpen: (stone: JwStoneCatalogItem) => void;
  onAsk: (stone: JwStoneCatalogItem) => void;
};

/**
 * Trending rail for homeless / anonymous inventory photographs.
 * Photo + color palette + Ask only — no placeholder names or invented specs.
 */
export function TrendingSection({ items, onOpen, onAsk }: TrendingSectionProps) {
  if (!items.length) return null;

  return (
    <section
      id="jw-trending"
      data-testid="jw-marketplace-trending"
      aria-labelledby="jw-trending-heading"
      className={`border-b ${jw.border} bg-[var(--jw-bg)]`}
    >
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2
            id="jw-trending-heading"
            className="font-editorial text-xl leading-tight text-[var(--jw-ink)] sm:text-2xl"
          >
            Trending
          </h2>
          <a
            href="#current-inventory"
            className={`text-sm font-semibold underline-offset-4 hover:underline ${jw.muted}`}
          >
            Full inventory
          </a>
        </div>

        <div
          className="scrollbar-hide -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:gap-3 sm:px-0"
          aria-label="Trending photographs"
        >
          {items.map((stone) => (
            <article
              key={stone.id}
              data-anonymous="true"
              data-trending="true"
              className={`w-[42vw] max-w-[200px] flex-none snap-start border sm:w-[160px] ${jw.border} ${jw.surface}`}
            >
              <button
                type="button"
                onClick={() => onOpen(stone)}
                className="group block w-full text-left"
                aria-label="Open stone photograph gallery"
              >
                <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[var(--jw-surface)]">
                  <img
                    src={stone.images[0]}
                    alt="Stone photograph from JW Stone"
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </span>
              </button>

              <div className="flex flex-col gap-2 px-2.5 py-2">
                <StonePalette
                  colorSwatches={stone.colorSwatches}
                  pairingSwatches={stone.pairingSwatches}
                  size="sm"
                />

                <button
                  type="button"
                  onClick={() => onAsk(stone)}
                  className={`inline-flex min-h-8 w-full items-center justify-center gap-1 px-2 text-[11px] ${jw.accentCta}`}
                >
                  <MessageCircle className="h-3 w-3" aria-hidden="true" />
                  Ask
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
