const COLOR_RANGE_VERSION = "slab-core-spectrum-3";

/**
 * Vertical-slice presentation uses the existing slab-core derivatives rather
 * than the original yard photographs. Each derivative was built from the
 * detected interior of one slab, normalized for orientation, cropped to remove
 * clamps, forklifts, sky, gravel, racks, and neighboring slabs, then resized to
 * a 400 × 1200 vertical face.
 *
 * This surface is an abundance signal, not a neutral-material sample. Only one
 * light neutral remains. The other seven slices deliberately move through
 * actual rust red, amber, gold, green, vivid blue, bronze, and black so the
 * first glance communicates that JW Stone can cover an unusually broad color
 * spectrum. Unnamed "trending selection" crops are not allowed on this surface.
 */
export const COLOR_RANGE_STONE_DEFS = [
  {
    stoneId: "rhino-white",
    colorFamily: "white",
    src: "/images/businesses/jw-stone/color-slivers/rhino-white.webp",
    fallbackSrc: "/images/businesses/jw-stone/color-slivers/galaxy-white.webp",
  },
  {
    stoneId: "dueto",
    colorFamily: "rust",
    src: "/images/businesses/jw-stone/color-slivers/dueto.webp",
    fallbackSrc: "/images/businesses/jw-stone/color-slivers/versace.webp",
  },
  {
    stoneId: "honey-onyx",
    colorFamily: "amber",
    src: "/images/businesses/jw-stone/color-slivers/honey-onyx.webp",
    fallbackSrc: "/images/businesses/jw-stone/color-slivers/fusion-brown.webp",
  },
  {
    stoneId: "gold-macaubas",
    colorFamily: "gold",
    src: "/images/businesses/jw-stone/color-slivers/gold-macaubas.webp",
    fallbackSrc: "/images/businesses/jw-stone/color-slivers/giallo-ornamental.webp",
  },
  {
    stoneId: "amazonic-green",
    colorFamily: "green",
    src: "/images/businesses/jw-stone/color-slivers/amazonic-green.webp",
    fallbackSrc: "/images/businesses/jw-stone/color-slivers/marbella-green.webp",
  },
  {
    stoneId: "blue-dream",
    colorFamily: "blue",
    src: "/images/businesses/jw-stone/color-slivers/blue-dream.webp",
    fallbackSrc: "/images/businesses/jw-stone/color-slivers/blue-bahia.webp",
  },
  {
    stoneId: "bronzonite",
    colorFamily: "bronze",
    src: "/images/businesses/jw-stone/color-slivers/bronzonite.webp",
    fallbackSrc: "/images/businesses/jw-stone/color-slivers/chocolate-brown.webp",
  },
  {
    stoneId: "titanium-black-leathered",
    colorFamily: "black",
    src: "/images/businesses/jw-stone/color-slivers/titanium-black-leathered.webp",
    fallbackSrc: "/images/businesses/jw-stone/color-slivers/preto-sao-gabriel.webp",
  },
] as const;

export const COLOR_RANGE_SLICES = Object.freeze(
  COLOR_RANGE_STONE_DEFS.map((definition) => Object.freeze({ ...definition }))
);
const COLOR_SLICE_PERCENT = 100 / COLOR_RANGE_SLICES.length;

function versionedImageUrl(src: string, version: string): string {
  return `${src}${src.includes("?") ? "&" : "?"}v=${version}`;
}

/** Browse-by-color preview: one continuous row of eight slab-only vertical slices. */
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
            data-crop-mode="slab-core-sliver"
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
                objectPosition: "center",
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

                // Never expose the browser's broken-image icon inside the color card.
                image.style.visibility = "hidden";
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
