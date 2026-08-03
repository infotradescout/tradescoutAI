import { describe, expect, it } from "vitest";
import { JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES } from "./reconciledInventory";
import {
  JW_STONE_ANONYMOUS_CATALOG,
  JW_STONE_ANONYMOUS_PUBLIC_LABEL,
  JW_STONE_CATALOG,
  JW_STONE_NAMED_CATALOG,
  filterJwStoneCatalog,
  getCatalogItemById,
  getFinishFilterOptions,
  getMaterialFilterOptions,
  getNamedCatalogItemByShareSlug,
  getOriginFilterOptions,
  projectJwStoneCatalogItem,
  resolveVerifiedOrigin,
} from "./catalog";

const canonicalStones = JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES.flatMap((category) =>
  category.stones.map((stone) => ({ stone, categorySlug: category.categorySlug }))
);

describe("JW Stone 2.0 catalog projection", () => {
  it("preserves all 148 reconciled selections and 433 source images", () => {
    expect(JW_STONE_CATALOG).toHaveLength(148);
    expect(JW_STONE_NAMED_CATALOG).toHaveLength(110);
    expect(JW_STONE_ANONYMOUS_CATALOG).toHaveLength(38);
    expect(new Set(JW_STONE_CATALOG.map((stone) => stone.id)).size).toBe(148);
    expect(JW_STONE_CATALOG.map((stone) => stone.id).sort()).toEqual(
      canonicalStones.map(({ stone }) => stone.slug).sort()
    );
    expect(JW_STONE_CATALOG.reduce((sum, stone) => sum + stone.images.length, 0)).toBe(433);
    expect(getCatalogItemById("amazonic-green")?.displayName).toBe("Amazonic Green");
    expect(getCatalogItemById("steel-gray")?.displayName).toBe("Steel Gray");
    expect(getNamedCatalogItemByShareSlug("versace")?.displayName).toBe("Versace");
    expect(getNamedCatalogItemByShareSlug("white-silk")?.displayName).toBe("White Silk");
  });

  it("keeps anonymous inventory publicly nameless and ineligible for sharing or saving", () => {
    for (const stone of JW_STONE_ANONYMOUS_CATALOG) {
      expect(stone).toMatchObject({
        displayName: null,
        publicLabel: JW_STONE_ANONYMOUS_PUBLIC_LABEL,
        anonymous: true,
        shareSlug: null,
        wishlistEligible: false,
      });
      expect(Object.prototype.hasOwnProperty.call(stone, "name")).toBe(false);
      expect(getNamedCatalogItemByShareSlug(stone.id)).toBeNull();
    }

    expect(JW_STONE_ANONYMOUS_CATALOG.map((stone) => stone.publicLabel)).toEqual(
      Array.from({ length: 38 }, () => "Call for availability")
    );
  });

  it("publishes only supported materials, finishes, and source evidence", () => {
    expect(getCatalogItemById("cristallo")).toMatchObject({
      materialId: "quartzite",
      materialLabel: "Quartzite",
      finishes: ["Honed", "Polished"],
      finishStatus: "explicit",
    });
    expect(getCatalogItemById("amazonic-green")).toMatchObject({
      materialId: null,
      materialLabel: null,
      finishes: [],
      finishStatus: "unconfirmed",
    });

    for (const projected of JW_STONE_CATALOG) {
      const canonical = canonicalStones.find(({ stone }) => stone.slug === projected.id)!.stone;
      expect(projected.images).toEqual(canonical.images);
      expect(projected.finishes).toEqual(canonical.finishes ?? []);
      expect(projected.sourceEvidence?.counts ?? []).toEqual(canonical.slabCounts ?? []);
      expect(Object.prototype.hasOwnProperty.call(projected.sourceEvidence ?? {}, "total")).toBe(
        false
      );
    }

    expect(getMaterialFilterOptions().some((option) => option.value === "unconfirmed")).toBe(false);
    expect(getFinishFilterOptions().map((option) => option.label)).toEqual([
      "Brushed",
      "Honed",
      "Leathered",
      "Polished",
    ]);
  });

  it("has no public price field or price-derived filter surface", () => {
    const forbiddenKey = /price|cost|amount|currency/i;
    for (const stone of JW_STONE_CATALOG) {
      expect(Object.keys(stone).filter((key) => forbiddenKey.test(key))).toEqual([]);
    }
  });

  it("shows the full catalog by default and treats color as an optional refinement", () => {
    expect(filterJwStoneCatalog({})).toEqual(JW_STONE_CATALOG);

    const honed = filterJwStoneCatalog({ finish: "honed" });
    expect(honed.length).toBeGreaterThan(0);
    expect(honed.every((stone) => stone.finishes.includes("Honed"))).toBe(true);

    const softLight = filterJwStoneCatalog({ color: "soft-light" });
    expect(softLight.length).toBeGreaterThan(0);
    expect(softLight.every((stone) => stone.colorDirection === "soft-light")).toBe(true);
  });

  it("keeps current origin empty and accepts only explicit verified origin fixtures", () => {
    expect(JW_STONE_CATALOG.every((stone) => stone.origin === null)).toBe(true);
    expect(getOriginFilterOptions()).toEqual([]);
    expect(resolveVerifiedOrigin(null)).toBeNull();
    expect(
      resolveVerifiedOrigin({ country: "Brazil", verified: false, source: "supplier" })
    ).toBeNull();
    expect(resolveVerifiedOrigin({ country: " ", verified: true, source: "supplier" })).toBeNull();
    expect(resolveVerifiedOrigin({ country: "Brazil", verified: true, source: " " })).toBeNull();
    expect(
      resolveVerifiedOrigin({ country: " Brazil ", verified: true, source: " JW record " })
    ).toEqual({
      country: "Brazil",
      verified: true,
      source: "JW record",
    });

    const canonical = canonicalStones.find(({ stone }) => stone.slug === "cristallo")!;
    const fixture = projectJwStoneCatalogItem({
      ...canonical,
      verifiedOrigin: { country: "Brazil", verified: true, source: "test source record" },
    });
    expect(fixture.origin?.country).toBe("Brazil");
    expect(getOriginFilterOptions([fixture])).toEqual([
      { value: "brazil", label: "Brazil", count: 1 },
    ]);
    expect(filterJwStoneCatalog({ origin: "brazil" }, [fixture])).toEqual([fixture]);
  });
});
