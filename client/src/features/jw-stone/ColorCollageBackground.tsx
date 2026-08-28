import { COLOR_COLLAGE_STRIPS } from "./storyBackgrounds";

const COLOR_COLLAGE_VERSION = "face-truth-1";

/**
 * Browse-by-color preview using complete stone faces instead of unreadable slivers.
 * The whole preview still opens the real interactive color picker below it.
 */
export function ColorCollageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--jw-dark)]"
      data-testid="jw-color-collage"
      aria-hidden="true"
    >
      <div className="grid h-full w-full grid-cols-2 grid-rows-4 gap-px bg-black/45 sm:grid-cols-4 sm:grid-rows-2">
        {COLOR_COLLAGE_STRIPS.map((strip, index) => (
          <span key={strip.src} className="relative min-h-0 min-w-0 overflow-hidden bg-black/30">
            <img
              src={`${strip.src}?v=${COLOR_COLLAGE_VERSION}`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading={index < 4 ? "eager" : "lazy"}
              decoding="async"
            />
          </span>
        ))}
      </div>
    </div>
  );
}
