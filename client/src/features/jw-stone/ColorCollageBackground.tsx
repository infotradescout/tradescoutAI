import { COLOR_COLLAGE_STRIPS } from "./storyBackgrounds";

const COLOR_COLLAGE_VERSION = "face-truth-1";
const COLOR_COLLAGE_DELIVERY_VERSION = "full-3";
const WHITE_STONE_FALLBACK_SRC =
  "/images/businesses/jw-stone/inventory-source/1eFzZ0N8SlJaweTLRTthTXfQtUyLinqRT.webp";
const COLOR_SLICE_PERCENT = 100 / COLOR_COLLAGE_STRIPS.length;

/** Browse-by-color preview: one continuous row of eight equal-width vertical stone slices. */
export function ColorCollageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--jw-dark)]"
      data-testid="jw-color-collage"
      aria-hidden="true"
    >
      <div
        data-testid="jw-color-collage-slices"
        className="h-full w-full overflow-hidden"
        style={{
          display: "flex",
          gap: 0,
          columnGap: 0,
          rowGap: 0,
          margin: 0,
          padding: 0,
        }}
      >
        {COLOR_COLLAGE_STRIPS.map((strip, index) => (
          <div
            key={strip.src}
            data-testid={`jw-color-collage-slice-${index}`}
            className="relative h-full min-h-0 min-w-0 overflow-hidden"
            style={{
              flex: `0 0 ${COLOR_SLICE_PERCENT}%`,
              width: `${COLOR_SLICE_PERCENT}%`,
              maxWidth: `${COLOR_SLICE_PERCENT}%`,
              margin: 0,
              padding: 0,
              border: 0,
            }}
          >
            <img
              src={`${strip.src}?v=${COLOR_COLLAGE_VERSION}&delivery=${COLOR_COLLAGE_DELIVERY_VERSION}`}
              alt=""
              className="absolute block object-cover"
              style={{
                inset: 0,
                left: "-1px",
                width: "calc(100% + 2px)",
                height: "100%",
                maxWidth: "none",
                margin: 0,
                padding: 0,
                border: 0,
              }}
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
          </div>
        ))}
      </div>
    </div>
  );
}
