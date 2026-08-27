import { describe, expect, it } from "vitest";
import generatedInventory from "@/data/jwStoneInventory.generated.json";
import { JW_STONE_INVENTORY_CATEGORIES, JW_STONE_INVENTORY_SUMMARY } from "@/data/jwStoneInventory";
import { JW_STONE_INVENTORY_RECONCILIATION } from "@/data/reconcileJwStoneInventory";
import {
  JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES,
  JW_STONE_MARKETPLACE_INVENTORY_SUMMARY,
} from "./reconciledInventory";
import { isJwStonePublicMediaPath } from "@shared/jwStonePublicMedia";

const baseStones = JW_STONE_INVENTORY_CATEGORIES.flatMap((category) => category.stones);
const marketplaceStones = JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES.flatMap(
  (category) => category.stones
);

function marketplaceStone(slug: string) {
  return marketplaceStones.find((stone) => stone.slug === slug);
}

describe("JW Stone unified reconciled inventory", () => {
  it("publishes one 158-selection catalog for profile and marketplace", () => {
    expect(JW_STONE_INVENTORY_SUMMARY).toMatchObject({
      stoneCount: 158,
      imageCount: JW_STONE_MARKETPLACE_INVENTORY_SUMMARY.imageCount,
    });
    expect(JW_STONE_MARKETPLACE_INVENTORY_SUMMARY).toEqual({
      stoneCount: 158,
      imageCount: JW_STONE_INVENTORY_SUMMARY.imageCount,
      needsMaterialConfirmation: JW_STONE_INVENTORY_SUMMARY.needsMaterialConfirmation,
      needsFinishConfirmation: JW_STONE_INVENTORY_SUMMARY.needsFinishConfirmation,
    });
    expect(new Set(baseStones.map((stone) => stone.slug)).size).toBe(158);
    expect(new Set(marketplaceStones.map((stone) => stone.slug)).size).toBe(158);
    expect(marketplaceStones.map((stone) => stone.slug).sort()).toEqual(
      baseStones.map((stone) => stone.slug).sort()
    );
    expect(new Set(marketplaceStones.flatMap((stone) => stone.images)).size).toBe(
      JW_STONE_INVENTORY_SUMMARY.imageCount
    );

    for (const stone of marketplaceStones) {
      for (const image of stone.images) {
        expect(isJwStonePublicMediaPath(image), image).toBe(true);
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
    expect(marketplaceStone("bianco-superiory")?.images).toHaveLength(3);
    expect(marketplaceStone("superiore")?.images).toHaveLength(1);
    expect(marketplaceStone("perla-venata")?.images).toHaveLength(1);
    expect(marketplaceStone("shadow-blue")?.images).toHaveLength(1);
    expect(marketplaceStone("honey-onyx")?.images).toHaveLength(6);

    const named = marketplaceStones.filter((stone) => stone.nameStatus === "source");
    const anonymous = marketplaceStones.filter((stone) => stone.nameStatus === "placeholder");
    expect(named).toHaveLength(120);
    expect(anonymous).toHaveLength(38);
    for (const stone of anonymous) {
      expect(stone.displayName).toBeNull();
      expect(stone.materialStatus).toBe("unconfirmed");
    }
  });

  it("derives finishes only from supplied source titles and never invents Dual Finish", () => {
    expect(marketplaceStone("arizona-gold")?.finishes).toEqual(["Polished"]);
    expect(marketplaceStone("carrara-white-brazil-119x75")?.finishes).toBeUndefined();
    expect(marketplaceStone("bianco-carrara")?.finishes).toEqual(["Polished"]);
    expect(marketplaceStone("fantasy-brown")?.finishes).toEqual(["Polished"]);
    expect(marketplaceStone("montana-bianco")?.finishes).toEqual(["Polished"]);
    expect(marketplaceStone("namib-bianco-select")?.finishes).toBeUndefined();
    expect(marketplaceStone("bianco-superiory")?.finishes).toEqual(["Leathered"]);
    expect(marketplaceStone("superiore")?.finishes).toEqual(["Brushed"]);
    expect(marketplaceStone("cristallo")?.finishes).toEqual(["Honed", "Polished"]);
    expect(marketplaceStone("trending-selection-08")?.finishes).toEqual(["Polished", "Leathered"]);
    expect(JSON.stringify(marketplaceStones)).not.toContain("Dual Finish");
  });
});
