import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JW_STONE_INVENTORY_CATEGORIES, JW_STONE_INVENTORY_SUMMARY } from "./jwStoneInventory";

const stones = JW_STONE_INVENTORY_CATEGORIES.flatMap((category) =>
  category.stones.map((stone) => ({ ...stone, categorySlug: category.categorySlug }))
);

describe("JW Stone reconciled inventory", () => {
  it("publishes the full optimized inventory set", () => {
    // 0fa9ad6 removed 38 verified corrupt images and Fusion Blue's only image.
    // These counts protect the cleaned source set, not the pre-cleanup catalog.
    expect(JW_STONE_INVENTORY_SUMMARY.stoneCount).toBe(119);
    expect(JW_STONE_INVENTORY_SUMMARY.imageCount).toBe(430);
    expect(new Set(stones.map((stone) => stone.slug)).size).toBe(119);

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
    expect(trending.reduce((total, stone) => total + stone.images.length, 0)).toBe(148);
    expect(stones.find((stone) => stone.slug === "honey-onyx")?.images).toHaveLength(3);
    expect(stones.find((stone) => stone.slug === "cristallo")?.images).toHaveLength(24);
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

  it("leaves absent finish evidence unconfirmed", () => {
    expect(stones.find((stone) => stone.slug === "arizona-gold")?.finishStatus).toBe("unconfirmed");
    expect(stones.find((stone) => stone.slug === "titanium")?.finishes).toEqual(["Leathered"]);
  });
});
