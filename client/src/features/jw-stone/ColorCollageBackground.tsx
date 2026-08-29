import { getCatalogItemById } from "./catalog";

const COLOR_RANGE_VERSION = "single-stone-spectrum-1";

/**
 * Curated for immediate visual range, not eight near-neutral swatches.
 * One real catalog stone photo per slice makes the card communicate that JW
 * Stone carries everything from light/translucent stone through rose, gold,
 * green, blue, earth tones, and deep black.
 */
export const COLOR_RANGE_STONE_DEFS = [
  { stoneId: "rhino-white", colorFamily: "white" },
  { stoneId: "cristallo", colorFamily: "crystal" },
  { stoneId: "alabama-rose", colorFamily: "rose" },
  { stoneId: "gold-macaubas", colorFamily: "gold" },
  { stoneId: "amazonic-green", colorFamily: "green" },
  { stoneId: "blue-bahia", colorFamily: "blue" },
  { stoneId: "emperor-brown", colorFamily: "earth" },
  { stoneId: "titanium", colorFamily: "black" },
] as const;

type ColorRangeSlice = Readonly<{
  stoneId: (typeof COLOR_RANGE_STONE_DEFS)[number]["stoneId"];
  colorFamily: (typeof COLOR_RANGE_STONE_DEFS)[number]["colorFamily"];
  src: string;
  fallbackSrc: string | null;
}>;

function resolveColorRangeSlices(): readonly ColorRangeSlice[] {
  return Object.freeze(
    COLOR_RANGE_STONE_DEFS.map((definition) => {
      const stone = getCatalogItemById(definition.stoneId);
      const src = stone?.images[0] ?? "";
      const fallbackSrc = stone?.images[1] ?? null;

      return Object.freeze({
        ...definition,
        src,
        fallbackSrc,
      });
    })
  );
}

export const COLOR_RANGE_SLICES = resolveColorRangeSlices();
const COLOR_SLICE_PERCENT = 100 / COLOR_RANGE_SLICES.length;

function versionedImageUrl(src: string, version: string): string {
  return `${src}${src.includes("?") ? "&" : "?"}v=${version}`;
}

/** Browse-by-color preview: one continuous row of eight equal, single-photo slices. */
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
        {COLOR_RANGE_SLICES.map((slice, index) => (
          <div
            key={slice.stoneId}
            data-testid={`jw-color-collage-slice-${index}`}
            data-stone-id={slice.stoneId}
            data-color-family={slice.colorFamily}
            className="relative h-full min-h-0 min-w-0 overflow-hidden"
            style={{
              flex: `0 0 ${COLOR_SLICE_PERCENT}%`,
              width: `${COLOR_SLICE_PERCENT}%`,
              maxWidth: `${COLOR_SLICE_PERCENT}%`,
              margin: 0,
              padding: 0,
              border: 0,
              boxSizing: "border-box",
            }}
          >
            {slice.src ? (
              <img
                src={versionedImageUrl(slice.src, COLOR_RANGE_VERSION)}
                alt=""
                className="absolute object-cover"
                style={{
                  display: "block",
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
                  const image = event.currentTarget;
                  if (image.dataset.fallbackApplied !== "true" && slice.fallbackSrc) {
                    image.dataset.fallbackApplied = "true";
                    image.src = versionedImageUrl(
                      slice.fallbackSrc,
                      `${COLOR_RANGE_VERSION}-fallback`
                    );
                    return;
                  }

                  // Never leave a browser broken-image icon in the color range card.
                  image.style.visibility = "hidden";
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
