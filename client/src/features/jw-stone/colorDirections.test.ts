import { describe, expect, it } from "vitest";
import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import {
  COLOR_DIRECTIONS,
  JW_STONE_COLOR_BY_SLUG,
  JW_STONE_SLUGS_BY_COLOR_DIRECTION,
  getColorDirectionForStone,
  isColorDirectionId,
} from "./colorDirections";

describe("JW Stone editorial color directions", () => {
  it("assigns every canonical inventory slug exactly once", () => {
    const canonicalSlugs = JW_STONE_INVENTORY_CATEGORIES.flatMap((category) =>
      category.stones.map((stone) => stone.slug)
    ).sort();
    const classifiedSlugs = Object.values(JW_STONE_SLUGS_BY_COLOR_DIRECTION).flat().sort();

    expect(classifiedSlugs).toHaveLength(148);
    expect(new Set(classifiedSlugs).size).toBe(148);
    expect(classifiedSlugs).toEqual(canonicalSlugs);
    expect(Object.keys(JW_STONE_COLOR_BY_SLUG).sort()).toEqual(canonicalSlugs);
  });

  it("keeps the reviewed distribution and public labels", () => {
    expect(
      Object.fromEntries(
        Object.entries(JW_STONE_SLUGS_BY_COLOR_DIRECTION).map(([id, slugs]) => [id, slugs.length])
      )
    ).toEqual({
      "soft-light": 50,
      "warm-earthy": 25,
      "cool-serene": 47,
      "deep-dramatic": 13,
      "bold-expressive": 13,
    });
    expect(COLOR_DIRECTIONS.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "soft-light", label: "Soft & Light" },
      { id: "warm-earthy", label: "Warm & Earthy" },
      { id: "cool-serene", label: "Cool & Serene" },
      { id: "deep-dramatic", label: "Deep & Dramatic" },
      { id: "bold-expressive", label: "Bold & Expressive" },
    ]);
  });

  it("resolves only supported direction ids and known stones", () => {
    expect(isColorDirectionId("soft-light")).toBe(true);
    expect(isColorDirectionId("Soft & Light")).toBe(false);
    expect(getColorDirectionForStone("amazonic-green")).toBe("bold-expressive");
    expect(getColorDirectionForStone("trending-selection-05")).toBe("cool-serene");
    expect(getColorDirectionForStone("trending-selection-09")).toBe("bold-expressive");
    expect(getColorDirectionForStone("shadow-blue")).toBe("cool-serene");
    expect(getColorDirectionForStone("not-in-inventory")).toBeNull();
  });
});
