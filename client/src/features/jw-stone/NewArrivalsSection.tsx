import { Images } from "lucide-react";
import { jw } from "./brand";
import { NewArrivalBadgeOverlay } from "./NewArrivalBadge";
import type { JwStoneCatalogItem } from "./types";

type NewArrivalsSectionProps = {
  items: readonly JwStoneCatalogItem[];
  onOpen: (stone: JwStoneCatalogItem) => void;
};

/**
 * Photo-first rail for stones inside the 14-day arrival window.
 * Mounts only when at least one stone is in-window (after First Cut, before inventory).
 * Shows slab size when Drive / reconciliation evidence includes it.
 * Owner label: New Arrivals (not CFA, not Trending Selection).
 */
export function NewArrivalsSection({ items, onOpen }: NewArrivalsSectionProps) {
  if (!items.length) return null;

  return (
    <section
      id="new-arrivals"
      data-testid="jw-new-arrivals"
      className={`border-b bg-[var(--jw-bg)] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 ${jw.border}`}
      aria-labelledby="new-arrivals-title"
    >
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-2.5 max-w-2xl">
          <h2
            id="new-arrivals-title"
            className="font-editorial text-xl text-[var(--jw-ink)] sm:text-2xl"
          >
            New Arrivals
          </h2>
          <p className={`mt-1 text-sm leading-5 ${jw.muted}`}>
            Recent stone photographs from JW Stone.
          </p>
        </div>

        <div
          className="scrollbar-hide -mx-4 grid auto-cols-[minmax(180px,220px)] grid-flow-col gap-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:gap-3 sm:px-6 lg:-mx-8 lg:px-8"
          aria-label="New Arrivals photographs"
        >
          {items.map((stone) => (
            <article
              key={stone.id}
              data-anonymous="true"
              data-new-arrival="true"
              className={`shrink-0 border ${jw.border} ${jw.surface}`}
            >
              <button
                type="button"
                onClick={() => onOpen(stone)}
                className="group block w-full text-left"
                aria-label="Open New Arrivals gallery"
              >
                <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[var(--jw-surface)]">
                  <img
                    src={stone.images[0]}
                    alt="New arrival stone photograph from JW Stone"
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                  <NewArrivalBadgeOverlay />
                  <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 bg-[var(--jw-dark)]/90 px-2 py-1 text-[11px] font-semibold text-white">
                    <Images className="h-3 w-3" aria-hidden="true" />
                    {stone.images.length}
                  </span>
                </span>
                <span className="block px-2.5 py-2">
                  {stone.slabDimensions ? (
                    <span className={`block text-[11px] leading-4 ${jw.muted}`}>
                      {stone.slabDimensions}
                    </span>
                  ) : null}
                  <span className="text-sm font-semibold text-[var(--jw-ink)] underline decoration-[var(--jw-accent)] underline-offset-4">
                    View photographs
                  </span>
                </span>
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
