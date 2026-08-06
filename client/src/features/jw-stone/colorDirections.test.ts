import { describe, expect, it } from "vitest";
import { JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES } from "./reconciledInventory";
import {
  COLOR_DIRECTIONS,
  JW_STONE_COLOR_BY_SLUG,
  JW_STONE_SLUGS_BY_COLOR_DIRECTION,
  getColorDirectionForStone,
  isColorDirectionId,
} from "./colorDirections";

describe("JW Stone editorial color directions", () => {
  it("assigns every canonical inventory slug exactly once", () => {
    const canonicalSlugs = JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES.flatMap((category) =>
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
      "soft-light": 49,
      "warm-earthy": 27,
      "cool-serene": 48,
      "deep-dramatic": 10,
      "bold-expressive": 14,
    });
    expect(COLOR_DIRECTIONS.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "soft-light", label: "Soft & Light" },
      { id: "warm-earthy", label: "Warm & Earthy" },
      { id: "cool-serene", label: "Cool & Serene" },
      { id: "deep-dramatic", label: "Black" },
      { id: "bold-expressive", label: "Bold & Expressive" },
    ]);
  });

  it("locks face-true reclasses that yard/surround chrome previously skewed", () => {
    // Green face washed white by outdoor glare → not Soft & Light.
    expect(getColorDirectionForStone("pinta-verde")).toBe("bold-expressive");
    // Brown faces parked in cool gray / black from floor & shadow.
    expect(getColorDirectionForStone("mexican-brown")).toBe("warm-earthy");
    expect(getColorDirectionForStone("chocolate-brown")).toBe("warm-earthy");
    expect(getColorDirectionForStone("dueto")).toBe("warm-earthy");
    // Near-black basalt face — not cool yard gray.
    expect(getColorDirectionForStone("matrix-basalt")).toBe("deep-dramatic");
    // Gray faces misread as warm gold / espresso from racks and shadow.
    expect(getColorDirectionForStone("jaguar-leather")).toBe("cool-serene");
    expect(getColorDirectionForStone("titanium")).toBe("cool-serene");
    expect(getColorDirectionForStone("soapstone")).toBe("cool-serene");
    // Soft white — not Cool & Serene / blue from yard wash.
    expect(getColorDirectionForStone("alabama-white")).toBe("soft-light");
    expect(getColorDirectionForStone("dallas-white")).toBe("soft-light");
    expect(getColorDirectionForStone("namib-fantasy")).toBe("soft-light");
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
