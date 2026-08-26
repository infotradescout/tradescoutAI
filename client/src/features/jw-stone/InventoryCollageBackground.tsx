import { INVENTORY_SECTION_BACKGROUND } from "./storyBackgrounds";

/**
 * Full-inventory collapsed-row atmosphere: outdoor slab-yard photo
 * (distinct from material warehouse and color face strips).
 */
export function InventoryCollageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="jw-inventory-collage"
      aria-hidden="true"
    >
      <img
        src={INVENTORY_SECTION_BACKGROUND.src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-bottom"
        loading="eager"
        decoding="async"
      />
    </div>
  );
}
