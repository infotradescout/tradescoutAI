import { Images } from "lucide-react";
import type { JwStone2InventoryItem } from "@/features/jw-stone-2/types";

type TrendingSelectionProps = {
  items: readonly JwStone2InventoryItem[];
  onOpenGallery: (item: JwStone2InventoryItem) => void;
};

export function TrendingSelection({ items, onOpenGallery }: TrendingSelectionProps) {
  if (!items.length) return null;

  return (
    <section className="jw2-trending" aria-labelledby="jw2-trending-title">
      <header>
        <p className="jw2-eyebrow">Trending Selection</p>
        <h2 id="jw2-trending-title">Call for availability.</h2>
        <p>Browse these JW Stone photographs and open any gallery for a closer look.</p>
      </header>
      <div className="jw2-trending-grid">
        {items.map((item) => (
          <article className="jw2-trending-card" key={item.id}>
            <button
              className="jw2-trending-image"
              type="button"
              onClick={() => onOpenGallery(item)}
              aria-label="Open this Trending Selection gallery"
            >
              <img
                src={item.images[0]}
                alt="Stone from JW Stone's Trending Selection"
                loading="lazy"
              />
              <span>
                <Images aria-hidden="true" size={15} />
                {item.images.length} {item.images.length === 1 ? "photo" : "photos"}
              </span>
            </button>
            <div>
              <p>Trending Selection</p>
              <h3>Call for availability</h3>
              <button type="button" onClick={() => onOpenGallery(item)}>
                View photographs
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
