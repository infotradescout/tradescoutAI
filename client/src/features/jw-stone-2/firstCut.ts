import { JW_STONE_2_INVENTORY, getJwStone2NamedItemBySlug } from "./inventory";
import type {
  JwStone2FirstCutAssignment,
  JwStone2FirstCutPlaceholder,
  JwStone2FirstCutSlot,
  JwStone2InventoryItem,
} from "./types";

/**
 * Intentionally empty until JW supplies and verifies explicit assignments.
 * Existing inventory is never promoted into First Cut by inference.
 */
export const JW_STONE_2_FIRST_CUT_ASSIGNMENTS: readonly JwStone2FirstCutAssignment[] =
  Object.freeze([]);

export function getJwStone2FirstCutAssignments(
  assignments: readonly JwStone2FirstCutAssignment[] = JW_STONE_2_FIRST_CUT_ASSIGNMENTS,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
) {
  const seen = new Set<string>();
  return assignments.flatMap(({ stoneId }) => {
    if (seen.has(stoneId)) return [];
    const stone = getJwStone2NamedItemBySlug(stoneId, inventory);
    if (!stone) return [];
    seen.add(stoneId);
    return [stone];
  });
}

export function getJwStone2FirstCutPlaceholder(index: number): JwStone2FirstCutPlaceholder {
  const ordinal = Math.max(0, Math.trunc(index)) + 1;
  return {
    kind: "placeholder",
    slotKey: `first-cut-slot-${ordinal}`,
    eyebrow: "First Cut Exclusive",
    title: "Upcoming reveal",
  };
}

export function getJwStone2FirstCutSlots(
  placeholderCount = 3,
  assignments: readonly JwStone2FirstCutAssignment[] = JW_STONE_2_FIRST_CUT_ASSIGNMENTS,
  inventory: readonly JwStone2InventoryItem[] = JW_STONE_2_INVENTORY
): JwStone2FirstCutSlot[] {
  const assigned = getJwStone2FirstCutAssignments(assignments, inventory).map(
    (stone): JwStone2FirstCutSlot => ({ kind: "assigned", stone })
  );
  if (assigned.length) return assigned;
  return Array.from({ length: Math.max(0, Math.trunc(placeholderCount)) }, (_, index) =>
    getJwStone2FirstCutPlaceholder(index)
  );
}
