import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import {
  JW_STONE_FIRST_CUT_ASSIGNMENTS,
  JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT,
  buildFirstCutPresentation,
} from "./firstCut";

describe("First Cut Exclusives data boundary", () => {
  it("ships reveal positions rather than inventory assignments", () => {
    expect(JW_STONE_FIRST_CUT_ASSIGNMENTS).toEqual([]);
    expect(buildFirstCutPresentation()).toEqual(
      Array.from({ length: JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT }, (_, index) => ({
        kind: "placeholder",
        position: index + 1,
      }))
    );
    expect(JW_STONE_CATALOG).toHaveLength(119);
  });

  it("accepts only explicit named verified assignments", () => {
    expect(
      buildFirstCutPresentation([
        { stoneId: "amazonic-green", verifiedExclusive: true, source: "JW supplied collection" },
      ])
    ).toMatchObject([{ kind: "stone", stone: { id: "amazonic-green" } }]);
    expect(
      buildFirstCutPresentation([
        { stoneId: "trending-selection-05", verifiedExclusive: true, source: "JW supplied" },
      ])
    ).toHaveLength(JW_STONE_FIRST_CUT_PLACEHOLDER_COUNT);
  });
});
