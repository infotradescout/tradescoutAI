import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import generatedInventory from "@/data/jwStoneInventory.generated.json";
import { JW_STONE_INVENTORY_CATEGORIES, JW_STONE_INVENTORY_SUMMARY } from "@/data/jwStoneInventory";
import { JW_STONE_INVENTORY_RECONCILIATION } from "@/data/reconcileJwStoneInventory";
import {
  JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES,
  JW_STONE_MARKETPLACE_INVENTORY_SUMMARY,
} from "./reconciledInventory";

const baseStones = JW_STONE_INVENTORY_CATEGORIES.flatMap((category) => category.stones);
const marketplaceStones = JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES.flatMap(
  (category) => category.stones
);

function marketplaceStone(slug: string) {
  return marketplaceStones.find((stone) => stone.slug === slug);
}

describe("JW Stone marketplace-only inventory reconciliation", () => {
  it("keeps the existing profile inventory untouched while publishing 148 marketplace selections", () => {
    expect(JW_STONE_INVENTORY_SUMMARY).toMatchObject({ stoneCount: 119, imageCount: 433 });
    expect(JW_STONE_MARKETPLACE_INVENTORY_SUMMARY).toEqual({
      stoneCount: 148,
      imageCount: 433,
    });
    expect(new Set(baseStones.map((stone) => stone.slug)).size).toBe(119);
    expect(new Set(marketplaceStones.map((stone) => stone.slug)).size).toBe(148);
    expect(new Set(marketplaceStones.flatMap((stone) => stone.images)).size).toBe(433);

    for (const stone of marketplaceStones) {
      for (const image of stone.images) {
        expect(
          fs.existsSync(path.resolve(process.cwd(), "client/public", image.replace(/^\//, ""))),
          image
        ).toBe(true);
      }
    }
  });

  it("assigns every formerly arbitrary-batch photo exactly once", () => {
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

  it("keeps confirmed named merges singular and anonymous bundles honestly unnamed", () => {
    expect(marketplaceStones.filter((stone) => stone.slug === "panda")).toHaveLength(1);
    expect(marketplaceStone("panda")?.images).toHaveLength(5);
    expect(new Set(marketplaceStone("panda")?.images).size).toBe(5);
    expect(marketplaceStone("shadow-storm")?.images).toHaveLength(8);
    expect(marketplaceStone("cristallo")?.images).toHaveLength(25);
    expect(marketplaceStone("bianco-superiory")?.images).toHaveLength(4);
    expect(marketplaceStone("shadow-blue")?.images).toHaveLength(1);
    expect(marketplaceStone("honey-onyx")?.images).toHaveLength(6);

    const named = marketplaceStones.filter((stone) => stone.nameStatus === "source");
    const anonymous = marketplaceStones.filter((stone) => stone.nameStatus === "placeholder");
    expect(named).toHaveLength(110);
    expect(anonymous).toHaveLength(38);
    for (const stone of anonymous) {
      expect(stone.displayName).toBeNull();
      expect(stone.materialStatus).toBe("unconfirmed");
    }
  });

  it("derives finishes only from supplied source titles and never invents Dual Finish", () => {
    expect(marketplaceStone("arizona-gold")?.finishes).toEqual(["Polished"]);
    expect(marketplaceStone("carrara-white-brazil")?.finishes).toEqual(["Polished"]);
    expect(marketplaceStone("fantasy-brown")?.finishes).toEqual(["Polished"]);
    expect(marketplaceStone("montana-bianco")?.finishes).toEqual(["Polished"]);
    expect(marketplaceStone("namib-bianco-select")?.finishes).toBeUndefined();
    expect(marketplaceStone("bianco-superiory")?.finishes).toEqual(["Leathered", "Brushed"]);
    expect(marketplaceStone("cristallo")?.finishes).toEqual(["Honed", "Polished"]);
    expect(marketplaceStone("trending-selection-08")?.finishes).toEqual(["Polished", "Leathered"]);
    expect(JSON.stringify(marketplaceStones)).not.toContain("Dual Finish");
  });
});
