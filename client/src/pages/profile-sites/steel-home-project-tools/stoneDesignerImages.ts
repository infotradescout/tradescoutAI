export const STONE_DESIGNER_IMAGE_ROUTE = "/images/stone-designer" as const;
export const STONE_DESIGNER_NAMED_PHOTO_ROUTE = `${STONE_DESIGNER_IMAGE_ROUTE}/named` as const;

const PHOTO_KEY_PATTERN = /^ph_[0-9a-f]{16}$/;
const NAMED_STONE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INVENTORY_IMAGE_PATH_PATTERN = /^\/images\/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g)$/i;

function hashPhotoIdentity(value: string, seed: number, reverse = false): string {
  let hash = seed >>> 0;
  for (let offset = 0; offset < value.length; offset += 1) {
    const index = reverse ? value.length - offset - 1 : offset;
    const code = value.charCodeAt(index);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= code >>> 8;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** True only for opaque photo keys produced by this module. */
export function isStoneDesignerPhotoKey(value: unknown): value is string {
  return typeof value === "string" && PHOTO_KEY_PATTERN.test(value);
}

/**
 * Build an order-independent photo identity from the canonical inventory asset
 * path. The resulting key contains no stone name, source filename, or array
 * position, so gallery reordering cannot change a saved selection.
 */
export function buildStoneDesignerPhotoKey(imageHref: string): string | null {
  const canonical = typeof imageHref === "string" ? imageHref.trim() : "";
  if (
    !INVENTORY_IMAGE_PATH_PATTERN.test(canonical) ||
    canonical.includes("..") ||
    canonical.includes("//")
  ) {
    return null;
  }
  return `ph_${hashPhotoIdentity(canonical, 0x811c9dc5)}${hashPhotoIdentity(
    canonical,
    0x9e3779b9,
    true
  )}`;
}

/** Resolve an opaque key within one stone without trusting a caller-supplied index. */
export function resolveStoneDesignerPhotoIndex(
  imageHrefs: readonly string[],
  photoKey: unknown
): number {
  if (!isStoneDesignerPhotoKey(photoKey)) return -1;
  return imageHrefs.findIndex((imageHref) => buildStoneDesignerPhotoKey(imageHref) === photoKey);
}

/**
 * Stable alias for an exact named-catalog photo. `stoneShareSlug` is the public
 * catalog alias; `imageHref` contributes only its opaque immutable key.
 */
export function buildNamedStoneDesignerImageHref(
  stoneShareSlug: string,
  imageHref: string
): string | null {
  const safeSlug = typeof stoneShareSlug === "string" ? stoneShareSlug.trim() : "";
  const photoKey = buildStoneDesignerPhotoKey(imageHref);
  if (!NAMED_STONE_SLUG_PATTERN.test(safeSlug) || !photoKey) return null;
  return `${STONE_DESIGNER_NAMED_PHOTO_ROUTE}/${encodeURIComponent(safeSlug)}/${photoKey}.webp`;
}

/**
 * Legacy positional alias retained for old links and existing renderer calls.
 * New saved/share/request identities must use `buildNamedStoneDesignerImageHref`
 * so a catalog reorder cannot silently select a different photograph.
 */
export function buildStoneDesignerImageHref(stoneId: string, imageIndex = 0): string {
  const safeIndex = Math.max(0, Math.round(imageIndex));
  return `${STONE_DESIGNER_IMAGE_ROUTE}/${encodeURIComponent(stoneId)}/${safeIndex + 1}.webp`;
}
