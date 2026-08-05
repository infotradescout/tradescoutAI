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
 * Assets live in `client/public/images/businesses/jw-stone/first-cut/` (01–05 may exist;
 * marketplace First Cut uses 01–03 only). Captions stay pending — do not invent names/specs.
 */
export const JW_STONE_FIRST_CUT_PHOTO_SLOTS: readonly FirstCutPhotoSlot[] = Object.freeze([
  { id: "first-cut-1", imageSrc: "/images/businesses/jw-stone/first-cut/01.jpg" },
  { id: "first-cut-2", imageSrc: "/images/businesses/jw-stone/first-cut/02.jpg" },
  { id: "first-cut-3", imageSrc: "/images/businesses/jw-stone/first-cut/03.jpg" },
]);

export const JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT = 3;

/** Shared section note — never repeat under every card. */
export const JW_STONE_FIRST_CUT_SECTION_NOTE =
  "Newly sourced by JW Stone. Names and specifications are added as inventory is confirmed.";

/** @deprecated Prefer JW_STONE_FIRST_CUT_SECTION_NOTE — kept for legacy test imports. */
export const JW_STONE_FIRST_CUT_PENDING_LABEL = "Details pending";

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
