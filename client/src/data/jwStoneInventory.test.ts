import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveJwStonePublicRequestName } from "@shared/jwStonePresentation";
import { JW_STONE_INVENTORY_CATEGORIES, JW_STONE_INVENTORY_SUMMARY } from "./jwStoneInventory";

const stones = JW_STONE_INVENTORY_CATEGORIES.flatMap((category) =>
  category.stones.map((stone) => ({ ...stone, categorySlug: category.categorySlug }))
);

describe("JW Stone reconciled inventory", () => {
  it("promotes only source-backed material research out of unconfirmed", () => {
    const bySlug = new Map(stones.map((stone) => [stone.slug, stone]));

    for (const slug of [
      "apollonis",
      "artemis",
      "calacatta-corchia",
      "calacatta-cremo",
      "emerald-pearl",
      "new-caledonia",
      "steel-gray",
    ]) {
      expect(bySlug.get(slug)?.materialStatus).toBe("published_source");
      expect(bySlug.get(slug)?.sourceNote).toContain("https://");
    }
    expect(bySlug.get("ceara-white")?.materialStatus).toBe("unconfirmed");
    expect(bySlug.get("ceara-white")?.categorySlug).toBe("unconfirmed");
    expect(bySlug.get("ceara-white")?.sourceNote).not.toContain("https://");
    expect(bySlug.get("artemis")?.categorySlug).toBe("quartzite");
    expect(bySlug.get("calacatta-corchia")?.categorySlug).toBe("marble");
  });

  it("publishes the full reconciled inventory set for profile and marketplace", () => {
    expect(JW_STONE_INVENTORY_SUMMARY.stoneCount).toBe(158);
    expect(JW_STONE_INVENTORY_SUMMARY.imageCount).toBe(443);
    expect(new Set(stones.map((stone) => stone.slug)).size).toBe(158);
    expect(stones.find((stone) => stone.slug === "fusion-blue")?.displayName).toBe("Fusion Blue");

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
    expect(trending.reduce((total, stone) => total + stone.images.length, 0)).toBe(130);
    expect(stones.find((stone) => stone.slug === "honey-onyx")?.images).toHaveLength(6);
    expect(stones.find((stone) => stone.slug === "cristallo")?.images).toHaveLength(25);
  });

  it("does not turn visual treatments into finishes", () => {
    const cristallo = stones.find((stone) => stone.slug === "cristallo");
    expect(cristallo?.finishes).toEqual(["Honed", "Polished"]);
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
    expect(stones.find((stone) => stone.slug === "steel-gray")?.categorySlug).toBe("granite");
    expect(stones.find((stone) => stone.slug === "new-caledonia")?.categorySlug).toBe("granite");
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

    expect(sourceNamed).toHaveLength(26);
    expect(syntheticGroups).toHaveLength(38);
    expect(syntheticGroups.every((stone) => stone.displayName === null)).toBe(true);

    for (const [slug, exactName] of [
      ["amazonic-green", "Amazonic Green"],
      ["steel-gray", "Steel Gray"],
      ["versace", "Versace"],
      ["white-silk", "White Silk"],
    ] as const) {
      expect(stones.find((stone) => stone.slug === slug)?.displayName).toBe(exactName);
    }
  });

  it("leaves absent finish evidence unconfirmed when no source title supplies a finish", () => {
    expect(stones.find((stone) => stone.slug === "namib-bianco-select")?.finishStatus).toBe(
      "unconfirmed"
    );
    expect(stones.find((stone) => stone.slug === "arizona-gold")?.finishes).toEqual(["Polished"]);
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
