import { describe, expect, it } from "vitest";
import { searchNamedJwStone2Inventory } from "./inventory";
import {
  JW_STONE_2_FIRST_CUT_ASSIGNMENTS,
  getJwStone2FirstCutAssignments,
  getJwStone2FirstCutPlaceholder,
  getJwStone2FirstCutSlots,
} from "./firstCut";
import { reconcileJwStone2Wishlist } from "./wishlistStorage";

describe("JW Stone 2.0 First Cut foundation", () => {
  it("ships no inferred assignments and renders intentional placeholders", () => {
    expect(JW_STONE_2_FIRST_CUT_ASSIGNMENTS).toEqual([]);
    expect(getJwStone2FirstCutAssignments()).toEqual([]);
    expect(getJwStone2FirstCutSlots()).toEqual([
      {
        kind: "placeholder",
        slotKey: "first-cut-slot-1",
        eyebrow: "First Cut Exclusive",
        title: "Upcoming reveal",
      },
      {
        kind: "placeholder",
        slotKey: "first-cut-slot-2",
        eyebrow: "First Cut Exclusive",
        title: "Upcoming reveal",
      },
      {
        kind: "placeholder",
        slotKey: "first-cut-slot-3",
        eyebrow: "First Cut Exclusive",
        title: "Upcoming reveal",
      },
    ]);
  });

  it("keeps placeholders outside inventory, search, and wishlist identity", () => {
    const placeholder = getJwStone2FirstCutPlaceholder(0);
    expect(placeholder).not.toHaveProperty("id");
    expect(placeholder).not.toHaveProperty("stoneId");
    expect(placeholder).not.toHaveProperty("image");
    expect(searchNamedJwStone2Inventory(placeholder.title)).toEqual([]);
    expect(reconcileJwStone2Wishlist([placeholder.slotKey])).toEqual({
      ids: [],
      removedIds: [placeholder.slotKey],
    });
  });

  it("is data-driven but accepts only explicit eligible named assignments", () => {
    expect(
      getJwStone2FirstCutAssignments([
        { stoneId: "taj-mahal" },
        { stoneId: "trending-selection-01" },
        { stoneId: "removed-stone" },
        { stoneId: "taj-mahal" },
      ]).map((stone) => stone.id)
    ).toEqual(["taj-mahal"]);
  });
});
