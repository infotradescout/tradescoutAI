import { COLOR_COLLAGE_STRIPS } from "./storyBackgrounds";

const COLOR_COLLAGE_VERSION = "face-truth-1";
const COLOR_COLLAGE_DELIVERY_VERSION = "full-1";

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
        {COLOR_COLLAGE_STRIPS.map((strip) => (
          <span key={strip.src} className="relative min-h-0 min-w-0 overflow-hidden">
            <img
              src={`${strip.src}?v=${COLOR_COLLAGE_VERSION}&delivery=${COLOR_COLLAGE_DELIVERY_VERSION}`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          </span>
        ))}
      </div>
    </div>
  );
}
