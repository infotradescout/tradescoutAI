import { getCatalogItemById } from "./catalog";
import type { JwStoneCatalogItem } from "./types";

export type FirstCutAssignment = Readonly<{
  stoneId: string;
  verifiedExclusive: true;
  source: string;
}>;

/** Image-only slot — no stone name/specs until JW supplies them. */
export type FirstCutPhotoSlot = Readonly<{
  id: string;
  imageSrc: string;
}>;

export type FirstCutPresentation =
  | Readonly<{ kind: "stone"; stone: JwStoneCatalogItem }>
  | Readonly<{ kind: "photo"; id: string; imageSrc: string }>
  | Readonly<{ kind: "placeholder"; position: number }>;

/** No named inventory assignment until JW verifies an explicit First Cut collection. */
export const JW_STONE_FIRST_CUT_ASSIGNMENTS: readonly FirstCutAssignment[] = Object.freeze([]);

/**
 * Photo-only First Cut slots (exactly three render in FirstCutSection).
 * Stable same-origin URLs resolve through the server-owned R2 media manifest
 * (01–05 may exist; marketplace First Cut uses three distinct photo slots).
 * Captions stay pending — do not invent names/specs.
 *
 * Lead (first slot) is the physically long green bookmatched pair (`05.jpg`) —
 * reads ~twice as wide as the single-slab supports. Supports: black vein (`01`) + Rouge De Roi (`02`).
 */
export const JW_STONE_FIRST_CUT_PHOTO_SLOTS: readonly FirstCutPhotoSlot[] = Object.freeze([
  { id: "first-cut-1", imageSrc: "/images/businesses/jw-stone/first-cut/05.jpg" },
  { id: "first-cut-2", imageSrc: "/images/businesses/jw-stone/first-cut/01.jpg" },
  // 03 is same Rouge De Roi lot as 02; keep 02 as the burgundy support.
  { id: "first-cut-3", imageSrc: "/images/businesses/jw-stone/first-cut/02.jpg" },
]);

export const JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT = 3;

/** @deprecated Kept for legacy test imports — section no longer surfaces pending copy. */
export const JW_STONE_FIRST_CUT_PENDING_LABEL = "Details pending";

/** True when the detail stone is an ephemeral First Cut photo (not named catalog). */
export function isFirstCutDetailStone(
  stone: Pick<JwStoneCatalogItem, "id" | "anonymous">
): boolean {
  return stone.anonymous && JW_STONE_FIRST_CUT_PHOTO_SLOTS.some((slot) => slot.id === stone.id);
}

/**
 * Ephemeral detail identity for unlinked First Cut photos.
 * Opens StoneDetailDialog with First Cut media + pending facts — no invented product name.
 * Ask + Share stay available in the dialog; Save stays off (not wishlist-eligible).
 */
export function firstCutPhotoAsDetailStone(slot: FirstCutPhotoSlot): JwStoneCatalogItem {
  return Object.freeze({
    id: slot.id,
    displayName: null,
    publicLabel: "First Cut",
    nameStatus: "placeholder",
    anonymous: true,
    shareSlug: null,
    wishlistEligible: false,
    colorDirection: "bold-expressive",
    colors: Object.freeze([]),
    colorSwatches: Object.freeze([]),
    pairingSwatches: Object.freeze([]),
    images: Object.freeze([slot.imageSrc]),
    materialId: null,
    materialLabel: null,
    materialStatus: "unconfirmed",
    finishes: Object.freeze([]),
    finishStatus: "unconfirmed",
    sourceEvidence: null,
    slabDimensions: null,
    origin: null,
    arrivedAt: null,
  });
}

/** Resolve a presentation item to a stone suitable for StoneDetailDialog. */
export function resolveFirstCutDetailStone(
  item: Extract<FirstCutPresentation, { kind: "stone" | "photo" }>
): JwStoneCatalogItem {
  if (item.kind === "stone") return item.stone;
  return firstCutPhotoAsDetailStone(item);
}

function dedupePresentation(items: FirstCutPresentation[]): FirstCutPresentation[] {
  const seen = new Set<string>();
  const out: FirstCutPresentation[] = [];
  for (const item of items) {
    const key =
      item.kind === "stone"
        ? `stone:${item.stone.id}`
        : item.kind === "photo"
          ? `photo:${item.imageSrc}`
          : `placeholder:${item.position}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function buildFirstCutPresentation(
  assignments: readonly FirstCutAssignment[] = JW_STONE_FIRST_CUT_ASSIGNMENTS,
  photoSlots: readonly FirstCutPhotoSlot[] = JW_STONE_FIRST_CUT_PHOTO_SLOTS
): FirstCutPresentation[] {
  const stones = assignments.flatMap((assignment) => {
    if (assignment.verifiedExclusive !== true || !assignment.source.trim()) return [];
    const stone = getCatalogItemById(assignment.stoneId);
    if (!stone || stone.anonymous || !stone.displayName) return [];
    return [{ kind: "stone", stone } as const];
  });

  if (stones.length) return dedupePresentation(stones);

  const photos = photoSlots
    .filter((slot) => Boolean(slot.id.trim() && slot.imageSrc.trim()))
    .map((slot) => ({ kind: "photo" as const, id: slot.id, imageSrc: slot.imageSrc }));

  if (photos.length) return dedupePresentation(photos);

  return Array.from({ length: JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT }, (_, index) => ({
    kind: "placeholder" as const,
    position: index + 1,
  }));
}
