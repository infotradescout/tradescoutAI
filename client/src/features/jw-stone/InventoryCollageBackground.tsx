import { INVENTORY_SECTION_BACKGROUND } from "./storyBackgrounds";

/**
 * Full-inventory collapsed-row atmosphere.
 *
 * Filling the very shallow desktop banner at 100% width still enlarges the
 * slabs and hides too much of the yard. Keep a soft full-bleed copy behind the
 * card, then present the same photograph slightly smaller and gently rotated
 * so more slab rows remain visible without exposing empty edges.
 */
export function InventoryCollageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden bg-stone-950"
      data-testid="jw-inventory-collage"
      data-image-treatment="zoomed-out-slab-panorama"
      aria-hidden="true"
    >
      <img
        src={INVENTORY_SECTION_BACKGROUND.src}
        alt=""
        className="absolute inset-0 block h-full w-full max-w-none scale-[1.04] object-cover object-[50%_54%] opacity-70 blur-[4px]"
        data-testid="jw-inventory-collage-fill"
        loading="eager"
        decoding="async"
      />

      <img
        src={INVENTORY_SECTION_BACKGROUND.src}
        alt=""
        className="absolute left-1/2 top-1/2 block h-[92%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 rotate-[1.5deg] sm:h-auto sm:w-[96%] lg:w-[88%]"
        data-testid="jw-inventory-collage-image"
        data-rotation="1.5"
        data-zoom="0.88-desktop"
        data-crop-focus="full-slab-yard"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
