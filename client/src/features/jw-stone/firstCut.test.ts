import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import {
  JW_STONE_FIRST_CUT_ASSIGNMENTS,
  JW_STONE_FIRST_CUT_PHOTO_SLOTS,
  JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT,
  JW_STONE_FIRST_CUT_SECTION_NOTE,
  buildFirstCutPresentation,
  firstCutPhotoAsDetailStone,
  resolveFirstCutDetailStone,
} from "./firstCut";

describe("First Cut Exclusives data boundary", () => {
  it("ships three photo-only First Cut slots with a shared section note (no invented names)", () => {
    expect(JW_STONE_FIRST_CUT_ASSIGNMENTS).toEqual([]);
    expect(JW_STONE_FIRST_CUT_PHOTO_SLOTS).toEqual([
      // Lead: physically long green bookmatched pair (not burgundy / black-vein).
      { id: "first-cut-1", imageSrc: "/images/businesses/jw-stone/first-cut/05.jpg" },
      { id: "first-cut-2", imageSrc: "/images/businesses/jw-stone/first-cut/01.jpg" },
      { id: "first-cut-3", imageSrc: "/images/businesses/jw-stone/first-cut/02.jpg" },
    ]);
    expect(buildFirstCutPresentation()).toEqual([
      { kind: "photo", id: "first-cut-1", imageSrc: JW_STONE_FIRST_CUT_PHOTO_SLOTS[0].imageSrc },
      { kind: "photo", id: "first-cut-2", imageSrc: JW_STONE_FIRST_CUT_PHOTO_SLOTS[1].imageSrc },
      { kind: "photo", id: "first-cut-3", imageSrc: JW_STONE_FIRST_CUT_PHOTO_SLOTS[2].imageSrc },
    ]);
    expect(JW_STONE_FIRST_CUT_SECTION_NOTE).toBe("New to market. First chance to buy.");
    expect(JW_STONE_FIRST_CUT_SECTION_NOTE).not.toMatch(/newly sourced/i);
    expect(JW_STONE_FIRST_CUT_SECTION_NOTE).not.toMatch(/Fresh from the first cut/i);
    expect(JW_STONE_CATALOG).toHaveLength(148);
  });

  it("deduplicates photo slots that share the same image source", () => {
    expect(
      buildFirstCutPresentation(
        [],
        [
          { id: "a", imageSrc: "/images/businesses/jw-stone/first-cut/01.jpg" },
          { id: "b", imageSrc: "/images/businesses/jw-stone/first-cut/01.jpg" },
          { id: "c", imageSrc: "/images/businesses/jw-stone/first-cut/02.jpg" },
        ]
      )
    ).toEqual([
      { kind: "photo", id: "a", imageSrc: "/images/businesses/jw-stone/first-cut/01.jpg" },
      { kind: "photo", id: "c", imageSrc: "/images/businesses/jw-stone/first-cut/02.jpg" },
    ]);
  });

  it("falls back to placeholders when photo slots are empty", () => {
    expect(buildFirstCutPresentation([], [])).toEqual(
      Array.from({ length: JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT }, (_, index) => ({
        kind: "placeholder",
        position: index + 1,
      }))
    );
  });

  it("accepts only explicit named verified assignments", () => {
    expect(
      buildFirstCutPresentation([
        { stoneId: "amazonic-green", verifiedExclusive: true, source: "JW supplied collection" },
      ])
    ).toMatchObject([{ kind: "stone", stone: { id: "amazonic-green" } }]);
    expect(
      buildFirstCutPresentation(
        [{ stoneId: "trending-selection-05", verifiedExclusive: true, source: "JW supplied" }],
        []
      )
    ).toHaveLength(JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT);
  });

  it("builds anonymous First Cut detail stones without inventing product names", () => {
    const detail = firstCutPhotoAsDetailStone(JW_STONE_FIRST_CUT_PHOTO_SLOTS[0]!);
    expect(detail.displayName).toBeNull();
    expect(detail.publicLabel).toBe("First Cut");
    expect(detail.anonymous).toBe(true);
    expect(detail.wishlistEligible).toBe(false);
    expect(detail.images).toEqual([JW_STONE_FIRST_CUT_PHOTO_SLOTS[0]!.imageSrc]);
    expect(
      resolveFirstCutDetailStone({
        kind: "photo",
        id: "first-cut-1",
        imageSrc: JW_STONE_FIRST_CUT_PHOTO_SLOTS[0]!.imageSrc,
      }).id
    ).toBe("first-cut-1");
  });
});
