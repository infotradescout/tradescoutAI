import { MATERIAL_SECTION_BACKGROUND } from "./storyBackgrounds";

/**
 * Browse-by-material collapsed-row atmosphere: warehouse slab yard (distinct
 * from color face strips and full-inventory outdoor yard photo).
 */
export function MaterialCollageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="jw-material-collage"
      aria-hidden="true"
    >
      <img
        src={MATERIAL_SECTION_BACKGROUND.src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
