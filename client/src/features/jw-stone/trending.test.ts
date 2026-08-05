import { describe, expect, it } from "vitest";
import { JW_STONE_ANONYMOUS_CATALOG, JW_STONE_CATALOG } from "./catalog";
import { selectTrendingItems } from "./trending";
import type { JwStoneCatalogItem } from "./types";

function fixtureStone(
  overrides: Partial<JwStoneCatalogItem> & Pick<JwStoneCatalogItem, "id">
): JwStoneCatalogItem {
  return {
    id: overrides.id,
    displayName: overrides.displayName ?? null,
    publicLabel: overrides.publicLabel ?? "New arrival",
    nameStatus: overrides.nameStatus ?? "placeholder",
    anonymous: overrides.anonymous ?? true,
    shareSlug: overrides.shareSlug ?? null,
    wishlistEligible: overrides.wishlistEligible ?? false,
    colorDirection: overrides.colorDirection ?? "cool-serene",
    colors: overrides.colors ?? [],
    colorSwatches: overrides.colorSwatches ?? ["#aabbcc"],
    pairingSwatches: overrides.pairingSwatches ?? ["#554433"],
    images: overrides.images ?? ["/images/businesses/jw-stone/inventory-source/example.webp"],
    materialId: overrides.materialId ?? null,
    materialLabel: overrides.materialLabel ?? null,
    materialStatus: overrides.materialStatus ?? "unconfirmed",
    finishes: overrides.finishes ?? [],
    finishStatus: overrides.finishStatus ?? "unconfirmed",
    sourceEvidence: overrides.sourceEvidence ?? null,
    slabDimensions: overrides.slabDimensions ?? null,
    origin: overrides.origin ?? null,
    arrivedAt: overrides.arrivedAt ?? null,
  };
}

describe("JW Stone Trending selection", () => {
  it("selects only anonymous / non-wishlist-eligible stones", () => {
    const catalog = [
      fixtureStone({ id: "anon-a" }),
      fixtureStone({
        id: "named",
        anonymous: false,
        displayName: "Named",
        publicLabel: "Named",
        nameStatus: "source",
        shareSlug: "named",
        wishlistEligible: true,
      }),
      fixtureStone({ id: "anon-b" }),
    ];

    expect(selectTrendingItems(catalog).map((stone) => stone.id)).toEqual(["anon-a", "anon-b"]);
  });

  it("excludes New Arrivals ids so Trending stays distinct", () => {
    const catalog = [fixtureStone({ id: "keep" }), fixtureStone({ id: "fresh" })];
    const selected = selectTrendingItems(catalog, {
      excludeIds: new Set(["fresh"]),
    });
    expect(selected.map((stone) => stone.id)).toEqual(["keep"]);
  });

  it("draws the live homeless set from anonymous catalog", () => {
    const selected = selectTrendingItems(JW_STONE_CATALOG);
    expect(selected).toHaveLength(JW_STONE_ANONYMOUS_CATALOG.length);
    expect(selected.every((stone) => stone.anonymous && !stone.wishlistEligible)).toBe(true);
    expect(selected.map((stone) => stone.id).sort()).toEqual(
      JW_STONE_ANONYMOUS_CATALOG.map((stone) => stone.id).sort()
    );
    expect(selected.some((stone) => /trending selection/i.test(stone.publicLabel))).toBe(false);
  });
});
