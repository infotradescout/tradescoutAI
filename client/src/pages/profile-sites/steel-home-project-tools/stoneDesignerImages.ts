export const STONE_DESIGNER_IMAGE_ROUTE = "/images/stone-designer" as const;

/**
 * Customer-facing alias for an exact catalog image. The server resolves this
 * route back to the selected named inventory record without exposing an
 * operational company name in the designer DOM or image URL.
 */
export function buildStoneDesignerImageHref(stoneId: string, imageIndex = 0): string {
  const safeIndex = Math.max(0, Math.round(imageIndex));
  return `${STONE_DESIGNER_IMAGE_ROUTE}/${encodeURIComponent(stoneId)}/${safeIndex + 1}.webp`;
}
