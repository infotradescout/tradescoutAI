import { getCatalogItemById } from "./catalog";
import type { JwStoneCatalogItem } from "./types";

export type FirstCutAssignment = Readonly<{
  stoneId: string;
  verifiedExclusive: true;
  source: string;
}>;

export type FirstCutPresentation =
  | Readonly<{ kind: "stone"; stone: JwStoneCatalogItem }>
  | Readonly<{ kind: "placeholder"; position: number }>;

/** No assignment exists until JW supplies and verifies an explicit First Cut collection. */
export const JW_STONE_FIRST_CUT_ASSIGNMENTS: readonly FirstCutAssignment[] = Object.freeze([]);

export const JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT = 3;

export function buildFirstCutPresentation(
  assignments: readonly FirstCutAssignment[] = JW_STONE_FIRST_CUT_ASSIGNMENTS
): FirstCutPresentation[] {
  const stones = assignments.flatMap((assignment) => {
    if (assignment.verifiedExclusive !== true || !assignment.source.trim()) return [];
    const stone = getCatalogItemById(assignment.stoneId);
    if (!stone || stone.anonymous || !stone.displayName) return [];
    return [{ kind: "stone", stone } as const];
  });

  if (stones.length) return stones;
  return Array.from({ length: JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT }, (_, index) => ({
    kind: "placeholder" as const,
    position: index + 1,
  }));
}
