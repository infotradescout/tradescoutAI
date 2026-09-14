import dominantColors from "@/data/jwStoneDominantColors.generated.json";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import { isHandScaleCoverImage } from "@/features/jw-stone/coverImages";
import {
  resolveSlabDimensionForInventoryImage,
  type SlabDimension,
} from "@/features/jw-stone/slabDimensions";
import { resolveJwStonePublicMediaAsset } from "@shared/jwStonePublicMedia";
import { buildStoneDesignerPhotoKey } from "./stoneDesignerImages";

export type StoneProjectionCrop = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

type StoneProjectionIdentity = {
  reason: string;
  sourceImageHref: string | null;
  sourcePhotoKey: string | null;
  /** Filename evidence for the original slab photo, never the size of a cropped texture. */
  sourceDimensions: SlabDimension | null;
};

export type StoneProjectionDecision = StoneProjectionIdentity &
  (
    | {
        kind: "reference-only";
        allowed: false;
        projectionImageHref: null;
        dimensions: null;
        crop: null;
      }
    | {
        kind: "illustrative";
        allowed: true;
        projectionImageHref: string;
        dimensions: null;
        /** Recorded interior of the source photo; the sliver has a further centered crop. */
        crop: StoneProjectionCrop;
      }
    | {
        kind: "physical";
        allowed: true;
        projectionImageHref: string;
        /** Verified physical size of the projected asset, not of its source photograph. */
        dimensions: SlabDimension;
        crop: StoneProjectionCrop | null;
      }
  );

type StoneFaceEvidence = {
  cover?: unknown;
  sliver?: unknown;
  sample?: {
    source?: unknown;
    mode?: unknown;
    confidence?: unknown;
    box?: unknown;
  } | null;
};

const STONE_FACE_EVIDENCE = (dominantColors as { stones: Record<string, StoneFaceEvidence> })
  .stones;
const STONE_FACE_SLIVER_PREFIX = "/images/businesses/jw-stone/color-slivers/";
const MINIMUM_SAMPLE_CONFIDENCE = 0.79;

function readCrop(value: unknown): StoneProjectionCrop | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const box = value as Record<string, unknown>;
  const { left, top, width, height } = box;
  if (
    typeof left !== "number" ||
    typeof top !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    ![left, top, width, height].every(Number.isFinite) ||
    left < 0 ||
    top < 0 ||
    width <= 0 ||
    height <= 0 ||
    left + width > 1 ||
    top + height > 1
  ) {
    return null;
  }
  return Object.freeze({ left, top, width, height });
}

function resolveIllustrativeCrop(source: string): {
  projectionImageHref: string;
  crop: StoneProjectionCrop;
} | null {
  const matching = Object.entries(STONE_FACE_EVIDENCE).filter(
    ([, entry]) => entry.cover === source
  );
  // An ambiguous source needs its evidence reconciled before it can select a texture.
  if (matching.length !== 1) return null;
  const [stoneId, entry] = matching[0];
  const stone = getCatalogItemById(stoneId);
  if (!stone || stone.anonymous || !stone.shareSlug || !stone.images.includes(source)) return null;

  const sample = entry.sample;
  if (
    !sample ||
    sample.source !== "inner-slab-face-only" ||
    !["detected-slab-core", "explicit-image-crop"].includes(String(sample.mode)) ||
    typeof sample.confidence !== "number" ||
    !Number.isFinite(sample.confidence) ||
    sample.confidence < MINIMUM_SAMPLE_CONFIDENCE ||
    sample.confidence > 1
  ) {
    return null;
  }
  const crop = readCrop(sample.box);
  const projectionImageHref = `${STONE_FACE_SLIVER_PREFIX}${stoneId}.webp`;
  if (!crop || entry.sliver !== projectionImageHref) return null;
  // Only the pinned derivative can become a material; aliases or guessed paths are insufficient.
  const asset = resolveJwStonePublicMediaAsset(projectionImageHref);
  if (
    !resolveJwStonePublicMediaAsset(source) ||
    !asset ||
    asset.relativePath !== `color-slivers/${stoneId}.webp`
  ) {
    return null;
  }
  return { projectionImageHref, crop };
}

/**
 * Raw inventory photos remain references. Existing exact-photo stone-face derivatives may be
 * previewed illustratively, but their crop has no measured physical size. A path containing
 * "clean" or a source filename containing slab dimensions cannot establish a physical texture.
 * No current catalog entry supplies the evidence needed to return the physical decision variant.
 */
export function getStoneProjectionDecision(
  imageHref: string | null | undefined
): StoneProjectionDecision {
  const source = typeof imageHref === "string" ? imageHref.trim() : "";
  const sourcePhotoKey = source ? buildStoneDesignerPhotoKey(source) : null;
  const handScale = source ? isHandScaleCoverImage(source) : false;
  const identity = {
    sourceImageHref: source || null,
    sourcePhotoKey,
    sourceDimensions:
      sourcePhotoKey && !handScale ? resolveSlabDimensionForInventoryImage(source) : null,
  };
  const reference = (reason: string): StoneProjectionDecision => ({
    ...identity,
    kind: "reference-only",
    allowed: false,
    reason,
    projectionImageHref: null,
    dimensions: null,
    crop: null,
  });

  if (!source) return reference("Choose an inventory photo to use as a visual reference.");
  if (handScale) {
    return reference("This hand-scale image is reference-only and cannot become a room material.");
  }
  const illustrative = sourcePhotoKey ? resolveIllustrativeCrop(source) : null;
  if (!illustrative) {
    return reference(
      "This photo has no reviewed stone-only crop available for the room. Keep it beside the model as an inventory reference."
    );
  }
  return {
    ...identity,
    ...illustrative,
    kind: "illustrative",
    allowed: true,
    reason:
      "Previewing a stone-face sample from this inventory photo. Pattern size is illustrative; the crop has no recorded physical dimensions.",
    dimensions: null,
  };
}
