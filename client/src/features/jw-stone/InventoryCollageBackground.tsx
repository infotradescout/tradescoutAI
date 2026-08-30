import { INVENTORY_SECTION_BACKGROUND } from "./storyBackgrounds";

/**
 * Full-inventory collapsed-row atmosphere.
 *
 * The source is already a wide 2000×756 yard photograph. Rotating it before
 * filling the extra-wide card forces the browser to crop a narrow vertical
 * strip from the source, which turns the banner into one enlarged slab edge.
 * Keep the photo in its native landscape orientation so the full horizontal
 * inventory run remains visible, then trim only the upper and lower dead space.
 */
export function InventoryCollageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="jw-inventory-collage"
      data-image-treatment="full-width-slab-panorama"
      aria-hidden="true"
    >
      <img
        src={INVENTORY_SECTION_BACKGROUND.src}
        alt=""
        className="absolute inset-0 block h-full w-full max-w-none object-cover object-[50%_54%]"
        data-testid="jw-inventory-collage-image"
        data-rotation="0"
        data-crop-focus="full-slab-row"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
