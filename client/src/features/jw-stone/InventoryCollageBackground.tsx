import { INVENTORY_SECTION_BACKGROUND } from "./storyBackgrounds";

/**
 * Full-inventory collapsed-row atmosphere.
 *
 * The source is a phone-oriented slab-yard photo. Treating it as a normal
 * landscape object-cover image cuts the yard down to a narrow center slice.
 * Swap the rendered frame dimensions, rotate the same photo 90 degrees, and
 * bias the crop toward the slab rows so the band shows the depth of inventory
 * instead of empty sky/ground.
 */
export function InventoryCollageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden [container-type:size]"
      data-testid="jw-inventory-collage"
      data-image-treatment="rotated-slab-yard"
      aria-hidden="true"
    >
      <div
        className="absolute left-1/2 top-1/2 h-[100cqw] w-[100cqh] -translate-x-1/2 -translate-y-1/2 rotate-90 scale-[1.04]"
        data-testid="jw-inventory-collage-rotated-frame"
        data-rotation="90"
        data-crop-focus="slab-rows"
      >
        <img
          src={INVENTORY_SECTION_BACKGROUND.src}
          alt=""
          className="block h-full w-full max-w-none object-cover object-[50%_72%]"
          data-testid="jw-inventory-collage-image"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
}
