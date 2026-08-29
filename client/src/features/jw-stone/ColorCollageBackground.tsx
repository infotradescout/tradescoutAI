import { COLOR_COLLAGE_STRIPS } from "./storyBackgrounds";

const COLOR_COLLAGE_VERSION = "face-truth-1";
const COLOR_COLLAGE_DELIVERY_VERSION = "full-2";
const WHITE_STONE_FALLBACK_SRC =
  "/images/businesses/jw-stone/inventory-source/1eFzZ0N8SlJaweTLRTthTXfQtUyLinqRT.webp";

/** Browse-by-color preview: one row of equal-width vertical stone slices. */
export function ColorCollageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--jw-dark)]"
      data-testid="jw-color-collage"
      aria-hidden="true"
    >
      <div
        data-testid="jw-color-collage-slices"
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${COLOR_COLLAGE_STRIPS.length}, minmax(0, 1fr))`,
        }}
      >
        {COLOR_COLLAGE_STRIPS.map((strip, index) => (
          <span key={strip.src} className="relative min-h-0 min-w-0 overflow-hidden">
            <img
              src={`${strip.src}?v=${COLOR_COLLAGE_VERSION}&delivery=${COLOR_COLLAGE_DELIVERY_VERSION}`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              decoding="async"
              onError={(event) => {
                if (index !== 0) return;
                const image = event.currentTarget;
                if (image.dataset.fallbackApplied === "true") {
                  image.style.visibility = "hidden";
                  return;
                }
                image.dataset.fallbackApplied = "true";
                image.src = `${WHITE_STONE_FALLBACK_SRC}?v=white-face-fallback-1`;
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
