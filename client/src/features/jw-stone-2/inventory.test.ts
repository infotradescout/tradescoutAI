import { describe, expect, it } from "vitest";
import { JW_STONE_INVENTORY_CATEGORIES } from "@/data/jwStoneInventory";
import {
  JW_STONE_2_ANONYMOUS_STONES,
  JW_STONE_2_COLOR_DIRECTION_BY_SLUG,
  JW_STONE_2_INVENTORY,
  JW_STONE_2_INVENTORY_COUNTS,
  JW_STONE_2_NAMED_STONES,
  adaptJwStoneInventory,
  filterJwStone2Inventory,
  getJwStone2ContactSelections,
  getJwStone2FilterOptions,
  searchNamedJwStone2Inventory,
  toJwStone2SafePublicSelection,
} from "./inventory";
import { DEFAULT_JW_STONE_2_FILTERS } from "./discoveryState";

const source = JW_STONE_INVENTORY_CATEGORIES.flatMap((category) =>
  category.stones.map((stone) => ({ ...stone, category }))
);

describe("JW Stone 2.0 inventory adapter", () => {
  it("adapts all 119 records without changing source identities", () => {
    expect(JW_STONE_2_INVENTORY_COUNTS).toEqual({ total: 119, named: 109, anonymous: 10 });
    expect(JW_STONE_2_INVENTORY).toHaveLength(source.length);

    for (const sourceStone of source) {
      const adapted = JW_STONE_2_INVENTORY.find((item) => item.id === sourceStone.slug);
      expect(adapted, sourceStone.slug).toBeDefined();
      expect(adapted?.images).toEqual(sourceStone.images);
      expect(adapted?.categorySlug).toBe(sourceStone.category.categorySlug);
      expect(adapted?.materialStatus).toBe(sourceStone.materialStatus);
      expect(adapted?.publicName).toBe(sourceStone.displayName);
      expect(adapted?.publicSlug).toBe(sourceStone.displayName ? sourceStone.slug : null);
    }

    expect(JW_STONE_2_NAMED_STONES).toHaveLength(109);
    expect(JW_STONE_2_ANONYMOUS_STONES).toHaveLength(10);
    expect(JW_STONE_2_NAMED_STONES.find((item) => item.id === "amazonic-green")?.publicName).toBe(
      "Amazonic Green"
    );
    expect(JW_STONE_2_NAMED_STONES.find((item) => item.id === "steel-gray")?.publicName).toBe(
      "Steel Gray"
    );
    expect(JW_STONE_2_NAMED_STONES.find((item) => item.id === "versace")?.publicName).toBe(
      "Versace"
    );
    expect(JW_STONE_2_NAMED_STONES.find((item) => item.id === "white-silk")?.publicName).toBe(
      "White Silk"
    );
    for (const slug of ["gold-macaubas", "rhino-white", "calacatta-vaguili"]) {
      expect(JW_STONE_2_INVENTORY.find((item) => item.id === slug)?.material, slug).toBeNull();
    }
  });

  it("uses a complete explicit presentation color map for every current source slug", () => {
    const sourceSlugs = source.map((stone) => stone.slug).sort();
    const mappedSlugs = Object.keys(JW_STONE_2_COLOR_DIRECTION_BY_SLUG).sort();
    expect(mappedSlugs).toEqual(sourceSlugs);
    expect(mappedSlugs).toHaveLength(119);
    for (const item of JW_STONE_2_INVENTORY) {
      expect(item.colorDirection).toBe(JW_STONE_2_COLOR_DIRECTION_BY_SLUG[item.id]);
    }
  });

  it("keeps anonymous inventory nameless and out of search and contact projections", () => {
    for (const item of JW_STONE_2_ANONYMOUS_STONES) {
      expect(item.publicName).toBeNull();
      expect(item.publicSlug).toBeNull();
      expect(item.isEligibleForPublicActions).toBe(false);
      expect(toJwStone2SafePublicSelection(item)).toBeNull();
    }
    expect(searchNamedJwStone2Inventory("Trending Selection")).toEqual([]);
    expect(searchNamedJwStone2Inventory("Unnamed slab")).toEqual([]);
    expect(getJwStone2ContactSelections(["trending-selection-05", "amazonic-green"])).toEqual([
      { id: "amazonic-green", label: "Amazonic Green" },
    ]);
  });

  it("exposes only explicit finishes and labels multiple real finishes without Dual Finish", () => {
    const cristallo = JW_STONE_2_INVENTORY.find((item) => item.id === "cristallo");
    const arizonaGold = JW_STONE_2_INVENTORY.find((item) => item.id === "arizona-gold");
    expect(cristallo?.verifiedFinishes).toEqual(["Polished", "Honed"]);
    expect(cristallo?.verifiedFinishLabel).toBe("Polished / Honed");
    expect(arizonaGold?.verifiedFinishes).toEqual([]);
    expect(arizonaGold?.verifiedFinishLabel).toBeNull();
    expect(JSON.stringify(JW_STONE_2_INVENTORY)).not.toContain("Dual Finish");
  });

  it("keeps source slab counts distinct from optional verified availability", () => {
    const matrix = JW_STONE_2_INVENTORY.find((item) => item.id === "matrix-basalt");
    expect(matrix?.sourceSlabCounts).toEqual([14]);
    expect(matrix?.sourceSlabCountTotal).toBe(14);
    expect(matrix?.availability).toBeUndefined();
    expect(getJwStone2FilterOptions().availability).toEqual([]);
  });

  it("keeps origin nullable and makes its filter appear only for supplied verified facts", () => {
    expect(JW_STONE_2_INVENTORY.every((item) => item.origin === null)).toBe(true);
    expect(getJwStone2FilterOptions()).toMatchObject({ origins: [], showOrigin: false });

    const fixtureInventory = adaptJwStoneInventory(JW_STONE_INVENTORY_CATEGORIES, {
      "taj-mahal": {
        origin: { country: "Brazil", verification: "supplied_verified" },
      },
    }).flatMap((category) => category.items);
    const fixtureTaj = fixtureInventory.find((item) => item.id === "taj-mahal");
    expect(fixtureTaj?.origin).toEqual({
      country: "Brazil",
      verification: "supplied_verified",
    });
    expect(getJwStone2FilterOptions(fixtureInventory)).toMatchObject({
      origins: [{ value: "brazil", label: "Brazil", count: 1 }],
      showOrigin: true,
    });
    expect(
      filterJwStone2Inventory(
        {
          ...DEFAULT_JW_STONE_2_FILTERS,
          buyer: "designer",
          color: fixtureTaj?.colorDirection || "warm-neutrals",
          origin: "Brazil",
        },
        fixtureInventory
      ).map((item) => item.id)
    ).toContain("taj-mahal");
  });

  it("requires both buyer and color before returning results", () => {
    expect(filterJwStone2Inventory(DEFAULT_JW_STONE_2_FILTERS)).toEqual([]);
    expect(
      filterJwStone2Inventory({
        ...DEFAULT_JW_STONE_2_FILTERS,
        buyer: "fabricator",
      })
    ).toEqual([]);
    expect(
      filterJwStone2Inventory({
        ...DEFAULT_JW_STONE_2_FILTERS,
        buyer: "fabricator",
        color: "warm-neutrals",
      }).length
    ).toBeGreaterThan(0);
  });
});
