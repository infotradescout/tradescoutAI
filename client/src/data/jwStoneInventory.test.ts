import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveJwStonePublicRequestName } from "@shared/jwStonePresentation";
import generatedInventory from "./jwStoneInventory.generated.json";
import { JW_STONE_INVENTORY_CATEGORIES, JW_STONE_INVENTORY_SUMMARY } from "./jwStoneInventory";
import { JW_STONE_INVENTORY_RECONCILIATION } from "./reconcileJwStoneInventory";

const stones = JW_STONE_INVENTORY_CATEGORIES.flatMap((category) =>
  category.stones.map((stone) => ({ ...stone, categorySlug: category.categorySlug }))
);

describe("JW Stone reconciled inventory", () => {
  it("publishes the full optimized inventory set", () => {
    expect(JW_STONE_INVENTORY_SUMMARY.stoneCount).toBe(148);
    expect(JW_STONE_INVENTORY_SUMMARY.imageCount).toBe(433);
    expect(new Set(stones.map((stone) => stone.slug)).size).toBe(148);
    expect(new Set(stones.flatMap((stone) => stone.images)).size).toBe(433);
    expect(stones.some((stone) => stone.slug === "fusion-blue")).toBe(false);

    for (const stone of stones) {
      for (const image of stone.images) {
        expect(
          fs.existsSync(path.resolve(process.cwd(), "client/public", image.replace(/^\//, ""))),
          image
        ).toBe(true);
      }
    }
  });

  it("keeps every usable source image while isolating uncertain photos", () => {
    const trending = stones.filter((stone) => stone.categorySlug === "unconfirmed");
    expect(trending.reduce((total, stone) => total + stone.images.length, 0)).toBe(143);
    expect(stones.find((stone) => stone.slug === "honey-onyx")?.images).toHaveLength(6);
    expect(stones.find((stone) => stone.slug === "panda")?.images).toHaveLength(5);
    expect(stones.filter((stone) => stone.slug === "panda")).toHaveLength(1);
    expect(stones.find((stone) => stone.slug === "shadow-storm")?.images).toHaveLength(8);
    expect(stones.find((stone) => stone.slug === "cristallo")?.images).toHaveLength(25);
    expect(stones.find((stone) => stone.slug === "bianco-superiory")?.images).toHaveLength(4);
    expect(stones.find((stone) => stone.slug === "shadow-blue")?.images).toHaveLength(1);
  });

  it("assigns every formerly unidentified photo to exactly one evidence-backed disposition", () => {
    const sourceIds = generatedInventory
      .filter((stone) => /^trending-selection-\d+$/.test(stone.slug))
      .flatMap((stone) => stone.sourceFileIds);
    const dispositionIds = [
      ...JW_STONE_INVENTORY_RECONCILIATION.namedMerges.flatMap(
        (disposition) => disposition.sourceFileIds
      ),
      ...JW_STONE_INVENTORY_RECONCILIATION.namedAdditions.flatMap(
        (disposition) => disposition.sourceFileIds
      ),
      ...JW_STONE_INVENTORY_RECONCILIATION.anonymousBundles.flatMap(
        (disposition) => disposition.sourceFileIds
      ),
    ];

    expect(sourceIds).toHaveLength(73);
    expect(dispositionIds).toHaveLength(73);
    expect(new Set(dispositionIds).size).toBe(73);
    expect([...dispositionIds].sort()).toEqual([...sourceIds].sort());
    expect(JW_STONE_INVENTORY_RECONCILIATION.anonymousBundles).toHaveLength(38);
  });

  it("does not turn visual treatments into finishes", () => {
    const cristallo = stones.find((stone) => stone.slug === "cristallo");
    expect(cristallo?.finishes).toEqual(["Polished", "Honed"]);
    expect(cristallo?.finishes).not.toContain("Backlit");
    expect(cristallo?.finishes).not.toContain("Reflected light");
  });

  it("moves conflicts out of misleading historical material buckets", () => {
    expect(stones.find((stone) => stone.slug === "matrix-basalt")?.categorySlug).toBe("basalt");
    expect(stones.find((stone) => stone.slug === "calacatta-andromeda")?.categorySlug).toBe(
      "quartz"
    );
    expect(stones.find((stone) => stone.slug === "calacatta-amala")?.categorySlug).toBe(
      "quartzite"
    );
    expect(stones.find((stone) => stone.slug === "steel-gray")?.categorySlug).toBe("unconfirmed");
    expect(stones.find((stone) => stone.slug === "new-caledonia")?.categorySlug).toBe(
      "unconfirmed"
    );
  });

  it("keeps source names separate from material-classification confidence", () => {
    expect(stones.find((stone) => stone.slug === "amazonic-green")).toMatchObject({
      name: "Amazonic Green",
      displayName: "Amazonic Green",
      nameStatus: "source",
      materialStatus: "unconfirmed",
    });
    expect(stones.find((stone) => stone.slug === "trending-selection-05")).toMatchObject({
      name: "Trending Selection 05",
      displayName: null,
      nameStatus: "placeholder",
      materialStatus: "unconfirmed",
    });

    const materialToConfirm = stones.filter((stone) => stone.materialStatus === "unconfirmed");
    const sourceNamed = materialToConfirm.filter((stone) => stone.nameStatus === "source");
    const syntheticGroups = materialToConfirm.filter((stone) => stone.nameStatus === "placeholder");

    expect(Object.fromEntries(sourceNamed.map((stone) => [stone.slug, stone.displayName]))).toEqual(
      {
        "amazonic-green": "Amazonic Green",
        apollonis: "Apollonis",
        artemis: "Artemis",
        "beverly-blue-antigo": "Beverly Blue Antigo",
        "bianco-palomino": "Bianco Palomino",
        "black-dunes": "Black Dunes",
        calacatta: "Calacatta",
        "calacatta-corchia": "Calacatta Corchia",
        "calacatta-cremo": "Calacatta Cremo",
        "calacatta-macchia-vecchia": "Calacatta Macchia Vecchia",
        "ceara-white": "Ceara White",
        "chocolate-brown": "Chocolate Brown",
        "emerald-pearl": "Emerald Pearl",
        "grand-constantine": "Grand Constantine",
        "kolkata-vegi-marble": "Kolkata Vegi Marble",
        "montana-bianco": "Montana Bianco",
        "mystic-spring": "Mystic Spring",
        "namib-bianco-select": "Namib Bianco Select",
        "namib-fantasy": "Namib Fantasy",
        "new-caledonia": "New Caledonia",
        perlatus: "Perlatus",
        "porto-fino": "Porto Fino",
        "river-white": "River White",
        "shadow-blue": "Shadow Blue",
        "steel-gray": "Steel Gray",
        "super-white": "Super White",
        "titanium-black-leathered": "Titanium Black",
        "toulon-white": "Toulon White",
        "valle-nevada-luna-pearl": "Valle Nevada (Luna Pearl)",
        versace: "Versace",
        "white-silk": "White Silk",
      }
    );
    expect(sourceNamed).toHaveLength(31);
    expect(syntheticGroups).toHaveLength(38);
    expect(
      syntheticGroups.map(({ name, displayName, slug, materialStatus }) => ({
        name,
        displayName,
        slug,
        materialStatus,
      }))
    ).toEqual(
      Array.from({ length: 38 }, (_, index) => {
        const ordinal = String(index + 1).padStart(2, "0");
        return {
          name: `Trending Selection ${ordinal}`,
          displayName: null,
          slug: `trending-selection-${ordinal}`,
          materialStatus: "unconfirmed",
        };
      })
    );

    for (const [slug, exactName] of [
      ["amazonic-green", "Amazonic Green"],
      ["steel-gray", "Steel Gray"],
      ["versace", "Versace"],
      ["white-silk", "White Silk"],
    ] as const) {
      expect(stones.find((stone) => stone.slug === slug)?.displayName).toBe(exactName);
    }
  });

  it("leaves absent finish evidence unconfirmed", () => {
    expect(stones.find((stone) => stone.slug === "arizona-gold")?.finishStatus).toBe("unconfirmed");
    expect(stones.find((stone) => stone.slug === "titanium")?.finishes).toEqual(["Leathered"]);
    expect(stones.find((stone) => stone.slug === "bianco-superiory")?.finishes).toEqual([
      "Leathered",
      "Brushed",
    ]);
    expect(stones.find((stone) => stone.slug === "trending-selection-08")?.finishes).toEqual([
      "Polished",
      "Leathered",
    ]);
  });

  it("suppresses crafted public names for synthetic Direct Connect item ids", () => {
    expect(
      resolveJwStonePublicRequestName({
        profileSlug: "jw-stone",
        itemId: "trending-selection-05",
        stoneName: "Unnamed slab #05",
      })
    ).toBeNull();
    expect(
      resolveJwStonePublicRequestName({
        profileSlug: "jw-stone",
        itemId: "trending-selection-05",
        stoneName: "Amazonic Green",
      })
    ).toBeNull();
    expect(
      resolveJwStonePublicRequestName({
        profileSlug: "jw-stone",
        itemId: "amazonic-green",
        stoneName: "Amazonic Green",
      })
    ).toBe("Amazonic Green");
  });
});
