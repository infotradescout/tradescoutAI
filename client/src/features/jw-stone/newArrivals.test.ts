import { describe, expect, it } from "vitest";
import { JW_STONE_INVENTORY_CAPTURED_ON, resolveJwStoneArrivedAt } from "./arrivalDates";
import { JW_STONE_CATALOG, projectJwStoneCatalogItem } from "./catalog";
import {
  NEW_ARRIVAL_WINDOW_DAYS,
  isNewArrival,
  newArrivalUntilIso,
  selectNewArrivalItems,
} from "./newArrivals";
import type { JwStoneCatalogItem } from "./types";
import type { JwStoneInventoryStone } from "@/data/jwStoneInventory";

function fixtureStone(
  overrides: Partial<JwStoneCatalogItem> & Pick<JwStoneCatalogItem, "id" | "arrivedAt">
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
    colorSwatches: overrides.colorSwatches ?? [],
    pairingSwatches: overrides.pairingSwatches ?? [],
    images: overrides.images ?? ["/images/businesses/jw-stone/inventory-source/example.webp"],
    materialId: overrides.materialId ?? null,
    materialLabel: overrides.materialLabel ?? null,
    materialStatus: overrides.materialStatus ?? "unconfirmed",
    finishes: overrides.finishes ?? [],
    finishStatus: overrides.finishStatus ?? "unconfirmed",
    sourceEvidence: overrides.sourceEvidence ?? null,
    slabDimensions: overrides.slabDimensions ?? null,
    origin: overrides.origin ?? null,
    arrivedAt: overrides.arrivedAt,
  };
}

describe("JW Stone new arrivals window", () => {
  it("resolves arrivedAt from Drive capture evidence for current inventory", () => {
    expect(resolveJwStoneArrivedAt("trending-selection-01")).toBe(
      `${JW_STONE_INVENTORY_CAPTURED_ON}T12:00:00.000Z`
    );
    expect(resolveJwStoneArrivedAt("taj-mahal")).toBe(
      `${JW_STONE_INVENTORY_CAPTURED_ON}T12:00:00.000Z`
    );
    expect(JW_STONE_CATALOG.every((stone) => stone.arrivedAt != null)).toBe(true);
  });

  it("keeps NEW ARRIVAL true for 14 days then drops", () => {
    const arrivedAt = "2026-07-20T12:00:00.000Z";
    expect(isNewArrival(arrivedAt, Date.parse("2026-07-20T12:00:00.000Z"))).toBe(true);
    expect(isNewArrival(arrivedAt, Date.parse("2026-08-02T11:59:59.000Z"))).toBe(true);
    expect(isNewArrival(arrivedAt, Date.parse("2026-08-03T12:00:00.000Z"))).toBe(false);
    expect(isNewArrival(null, Date.parse("2026-07-21T12:00:00.000Z"))).toBe(false);
    expect(newArrivalUntilIso(arrivedAt)).toBe("2026-08-03T12:00:00.000Z");
    expect(NEW_ARRIVAL_WINDOW_DAYS).toBe(14);
  });

  it("selects only in-window anonymous stones, newest first, excluding hand-only", () => {
    const now = Date.parse("2026-08-01T12:00:00.000Z");
    const catalog = [
      fixtureStone({
        id: "older-anon",
        arrivedAt: "2026-07-10T12:00:00.000Z",
        images: ["/images/businesses/jw-stone/inventory-source/older.webp"],
      }),
      fixtureStone({
        id: "newer-anon",
        arrivedAt: "2026-07-28T12:00:00.000Z",
        images: ["/images/businesses/jw-stone/inventory-source/newer.webp"],
      }),
      fixtureStone({
        id: "mid-anon",
        arrivedAt: "2026-07-25T12:00:00.000Z",
        images: ["/images/businesses/jw-stone/inventory-source/mid.webp"],
      }),
      fixtureStone({
        id: "named-fresh",
        anonymous: false,
        displayName: "Fresh Named",
        publicLabel: "Fresh Named",
        nameStatus: "source",
        shareSlug: "named-fresh",
        wishlistEligible: true,
        arrivedAt: "2026-07-29T12:00:00.000Z",
      }),
    ];

    const selected = selectNewArrivalItems(catalog, { now });
    expect(selected.map((stone) => stone.id)).toEqual(["newer-anon", "mid-anon"]);
    expect(selected.every((stone) => isNewArrival(stone.arrivedAt, now))).toBe(true);
  });

  it("hides the live New Arrivals rail when capture dates are outside the 14-day window", () => {
    // Today (conversation clock) is 2026-08-04; Drive capture is 2026-07-13.
    const selected = selectNewArrivalItems(JW_STONE_CATALOG, {
      now: Date.parse("2026-08-04T12:00:00.000Z"),
    });
    expect(selected).toEqual([]);
  });

  it("projects arrivedAt onto catalog items", () => {
    const stone: JwStoneInventoryStone = {
      name: "Trending Selection 01",
      displayName: null,
      nameStatus: "placeholder",
      slug: "trending-selection-01",
      images: [
        "/images/businesses/jw-stone/inventory-source/1pmQor_1An8FJAjVdBcvNkyZZAGRFrlHs.webp",
      ],
      materialStatus: "unconfirmed",
      finishStatus: "unconfirmed",
      sourceNote: "test",
    };
    const projected = projectJwStoneCatalogItem({
      stone,
      categorySlug: "unconfirmed",
    });
    expect(projected.arrivedAt).toBe(`${JW_STONE_INVENTORY_CAPTURED_ON}T12:00:00.000Z`);
  });
});
