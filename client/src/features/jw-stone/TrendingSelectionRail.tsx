import { Images } from "lucide-react";
import type { JwStoneCatalogItem } from "./types";

type TrendingSelectionRailProps = {
  items: readonly JwStoneCatalogItem[];
  onOpen: (stone: JwStoneCatalogItem) => void;
};

export function TrendingSelectionRail({ items, onOpen }: TrendingSelectionRailProps) {
  if (!items.length) return null;

  return (
    <section className="mt-16 border-t border-stone-300 pt-10" aria-labelledby="trending-title">
      <div className="mb-7 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">
          Trending Selection
        </p>
        <h2 id="trending-title" className="mt-3 font-editorial text-4xl sm:text-5xl">
          Call for availability.
        </h2>
      </div>

      <div
        className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12"
        aria-label="Trending Selection photographs"
      >
        {items.map((stone) => (
          <article
            key={stone.id}
            data-anonymous="true"
            className="w-[82vw] max-w-[420px] shrink-0 snap-start border border-stone-300 bg-white"
          >
            <button
              type="button"
              onClick={() => onOpen(stone)}
              className="group block w-full text-left"
              aria-label="Open this Trending Selection gallery"
            >
              <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-stone-200">
                <img
                  src={stone.images[0]}
                  alt="Stone from JW Stone's Trending Selection"
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-2 bg-stone-950/90 px-3 py-2 text-xs font-semibold text-white">
                  <Images className="h-4 w-4" aria-hidden="true" />
                  {stone.images.length} {stone.images.length === 1 ? "photo" : "photos"}
                </span>
              </span>
              <span className="block p-5">
                <span className="block font-editorial text-2xl text-stone-950">
                  Call for availability
                </span>
                <span className="mt-3 block text-sm font-semibold text-stone-700 underline decoration-stone-400 underline-offset-4">
                  View photographs
                </span>
              </span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
