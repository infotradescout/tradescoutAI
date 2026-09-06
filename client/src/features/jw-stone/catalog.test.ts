import { describe, expect, it } from "vitest";
import { JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES } from "./reconciledInventory";
import {
  JW_STONE_ANONYMOUS_CATALOG,
  JW_STONE_ANONYMOUS_PUBLIC_LABEL,
  JW_STONE_CATALOG,
  JW_STONE_NAMED_CATALOG,
  JW_STONE_UNCONFIRMED_MATERIAL_LABEL,
  filterJwStoneCatalog,
  getCatalogItemById,
  getColorFilterOptions,
  getMaterialFilterOptions,
  getNamedCatalogItemByShareSlug,
  getOriginFilterOptions,
  groupNamedCatalogByMaterial,
  materialSectionAnchorId,
  projectJwStoneCatalogItem,
  resolveVerifiedOrigin,
} from "./catalog";

const canonicalStones = JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES.flatMap((category) =>
  category.stones.map((stone) => ({ stone, categorySlug: category.categorySlug }))
);

describe("JW Stone 2.0 catalog projection", () => {
  it("preserves all 158 reconciled selections and every mapped photo in the public gallery", () => {
    const sourceImageCount = canonicalStones.reduce(
      (sum, { stone }) => sum + stone.images.length,
      0
    );
    const publicImageCount = JW_STONE_CATALOG.reduce((sum, stone) => sum + stone.images.length, 0);
    const multiImageStones = JW_STONE_CATALOG.filter((stone) => stone.images.length > 1).length;
    expect(JW_STONE_CATALOG).toHaveLength(158);
    expect(JW_STONE_NAMED_CATALOG).toHaveLength(120);
    expect(JW_STONE_ANONYMOUS_CATALOG).toHaveLength(38);
    expect(new Set(JW_STONE_CATALOG.map((stone) => stone.id)).size).toBe(158);
    expect(JW_STONE_CATALOG.map((stone) => stone.id).sort()).toEqual(
      canonicalStones.map(({ stone }) => stone.slug).sort()
    );
    expect(sourceImageCount).toBe(443);
    expect(publicImageCount).toBe(sourceImageCount);
    expect(multiImageStones).toBeGreaterThan(80);
    expect(getCatalogItemById("amazonic-green")?.displayName).toBe("Amazonic Green");
    expect(getCatalogItemById("steel-gray")?.displayName).toBe("Steel Gray");
    expect(getNamedCatalogItemByShareSlug("versace")?.displayName).toBe("Versace");
    expect(getNamedCatalogItemByShareSlug("white-silk")?.displayName).toBe("White Silk");
    expect(getCatalogItemById("matrix-basalt")?.slabDimensions).toMatch(/126×78"|127×77\.5"/);
    expect(getCatalogItemById("trending-selection-01")?.slabDimensions).toBe('126×76"');
  });

  it("keeps released item slugs bound to their original photographed stones", () => {
    expect(getCatalogItemById("soapstone")?.id).toBe("marina-black-soapstone");
    expect(getNamedCatalogItemByShareSlug("soapstone")?.id).toBe("marina-black-soapstone");
    expect(getCatalogItemById("carrara-white-brazil")?.id).toBe("bianco-carrara");
    expect(getNamedCatalogItemByShareSlug("carrara-white-brazil")?.id).toBe("bianco-carrara");

    expect(getCatalogItemById("soapstone-117x70")?.displayName).toBe("Soapstone");
    expect(getCatalogItemById("carrara-white-brazil-119x75")?.displayName).toBe(
      "Carrara White Brazil"
    );
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
      Array.from({ length: 38 }, () => "New arrival")
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
      // Cover ranking may reorder, but every mapped inventory photo stays in the gallery.
      expect(projected.images.length).toBe(canonical.images.length);
      expect([...projected.images].sort()).toEqual([...canonical.images].sort());
      expect(projected.finishes).toEqual(canonical.finishes ?? []);
      expect(projected.sourceEvidence?.counts ?? []).toEqual(canonical.slabCounts ?? []);
      expect(Object.prototype.hasOwnProperty.call(projected.sourceEvidence ?? {}, "total")).toBe(
        false
      );
    }

    expect(getMaterialFilterOptions().some((option) => option.value === "unconfirmed")).toBe(false);
    expect([...new Set(JW_STONE_CATALOG.flatMap((stone) => stone.finishes))].sort()).toEqual([
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

  it("shows the full catalog by default and treats aesthetic and literal color as refinements", () => {
    expect(filterJwStoneCatalog({})).toEqual(JW_STONE_CATALOG);

    const softLight = filterJwStoneCatalog({ aesthetic: "soft-light" });
    expect(softLight.length).toBeGreaterThan(0);
    expect(softLight.every((stone) => stone.colorDirection === "soft-light")).toBe(true);

    const whites = filterJwStoneCatalog({ color: "white" });
    expect(whites.length).toBeGreaterThan(0);
    expect(whites.every((stone) => stone.colors.includes("white"))).toBe(true);
    expect(getColorFilterOptions().some((option) => option.value === "white")).toBe(true);
    // Beige appears from photographed palettes (not name matching).
    expect(getColorFilterOptions().some((option) => option.value === "beige")).toBe(true);
    expect(JW_STONE_CATALOG.some((stone) => stone.colorSwatches.length === 0)).toBe(true);
    expect(
      JW_STONE_CATALOG.filter((stone) => stone.colorSwatches.length === 0).every(
        (stone) => stone.colors.length === 0 && stone.pairingSwatches.length === 0
      )
    ).toBe(true);

    const quartzite = filterJwStoneCatalog({ material: "quartzite" });
    expect(quartzite.length).toBeGreaterThan(0);
    expect(quartzite.every((stone) => stone.materialId === "quartzite")).toBe(true);
  });

  it("groups the full named inventory by real material categories", () => {
    const sections = groupNamedCatalogByMaterial(JW_STONE_NAMED_CATALOG);
    expect(sections.map((section) => section.materialId)).toEqual([
      "granite",
      "marble",
      "quartzite",
      "quartz",
      "onyx",
      "soapstone",
      "basalt",
      "unconfirmed",
    ]);
    expect(sections.find((section) => section.materialId === "granite")).toMatchObject({
      materialLabel: "Granite",
      filterable: true,
    });
    expect(sections.find((section) => section.materialId === "quartz")).toMatchObject({
      materialLabel: "Engineered Quartz",
      filterable: true,
    });
    expect(sections.find((section) => section.materialId === "unconfirmed")).toMatchObject({
      materialLabel: JW_STONE_UNCONFIRMED_MATERIAL_LABEL,
      filterable: false,
    });
    expect(sections.reduce((sum, section) => sum + section.stones.length, 0)).toBe(120);
    expect(sections.every((section) => section.stones.every((stone) => !stone.anonymous))).toBe(
      true
    );
    expect(materialSectionAnchorId("marble")).toBe("inventory-marble");
    expect(groupNamedCatalogByMaterial(JW_STONE_ANONYMOUS_CATALOG)).toEqual([]);
  });

  it("publishes the owner-confirmed Iranian onyx origin and leaves other origins unknown", () => {
    expect(
      JW_STONE_CATALOG.filter((stone) => stone.origin).map((stone) => [
        stone.id,
        stone.origin?.country,
      ])
    ).toEqual([["honey-onyx", "Iran"]]);
    expect(getOriginFilterOptions().map((option) => option.value)).toEqual(["iran"]);
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
