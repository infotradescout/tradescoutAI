import { isHandScaleCoverImage } from "@/features/jw-stone/coverImages";
import { resolveSlabDimensionForInventoryImage } from "@/features/jw-stone/slabDimensions";

export type StoneProjectionDecision = {
  allowed: boolean;
  reason: string;
  dimensions: { widthIn: number; heightIn: number } | null;
};

/**
 * Inventory photos are evidence first. They may include a rack, clamp, hand, label, yard, or
 * neighboring slab. Only an explicitly prepared stone-only texture asset may be projected into a
 * room. Raw catalog photos remain visible as references beside the measured model.
 */
export function getStoneProjectionDecision(imageHref: string | null | undefined): StoneProjectionDecision {
  const source = typeof imageHref === "string" ? imageHref.trim() : "";
  const dimensions = source ? resolveSlabDimensionForInventoryImage(source) : null;

  if (!source) {
    return {
      allowed: false,
      reason: "Choose an inventory photo to use as a visual reference.",
      dimensions: null,
    };
  }

  if (isHandScaleCoverImage(source)) {
    return {
      allowed: false,
      reason: "This hand-scale image is reference-only and cannot become a room material.",
      dimensions: null,
    };
  }

  if (!dimensions) {
    return {
      allowed: false,
      reason: "This photo has no verified slab dimensions, so it remains reference-only.",
      dimensions: null,
    };
  }

  const normalized = source.replace(/\\/g, "/").toLowerCase().split(/[?#]/)[0];
  const isPreparedStoneOnlyAsset =
    normalized.includes("/stone-textures/clean/") ||
    normalized.includes("/stone-designer-clean/") ||
    normalized.includes("/projection-ready/");

  if (!isPreparedStoneOnlyAsset) {
    return {
      allowed: false,
      reason:
        "The recorded dimensions are useful, but this raw inventory photo has not been approved as a stone-only crop. It stays beside the model instead of being stretched across the room.",
      dimensions,
    };
  }

  return {
    allowed: true,
    reason: "Using a verified stone-only crop with recorded slab dimensions.",
    dimensions,
  };
}
