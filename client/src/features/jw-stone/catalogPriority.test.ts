import { describe, expect, it } from "vitest";
import { rankJwStoneCatalogForBrowse } from "./catalog";
import type { JwStoneCatalogItem } from "./types";

function catalogItem(id: string, displayName: string): JwStoneCatalogItem {
  return {
    id,
    displayName,
    publicLabel: displayName,
    shareSlug: id,
    anonymous: false,
  } as JwStoneCatalogItem;
}

describe("JW Stone browse priority", () => {
  it("features Honey Onyx without changing facts or ordinary material order", () => {
    const honey = catalogItem("honey-onyx", "Honey Onyx");
    const other = catalogItem("black-dunes", "Black Dunes");
    expect(rankJwStoneCatalogForBrowse([other, honey])).toEqual([honey, other]);
  });
  it("puts priority inventory first without changing ordinary-item order", () => {
    const ordinaryA = catalogItem("ordinary-a", "Ordinary A");
    const blueBahia = catalogItem("blue-bahia", "Blue Bahia");
    const ordinaryB = catalogItem("ordinary-b", "Ordinary B");
    const avalanche = catalogItem("avalanche", "Avalanche");

    expect(
      rankJwStoneCatalogForBrowse([ordinaryA, blueBahia, ordinaryB, avalanche]).map(
        (stone) => stone.id
      )
    ).toEqual(["avalanche", "blue-bahia", "ordinary-a", "ordinary-b"]);
  });

  it("recognizes catalog-name aliases while leaving unmatched items stable", () => {
    const ordinaryA = catalogItem("ordinary-a", "Ordinary A");
    const vagli = catalogItem("supplier-vagli", "Calacatta Vagli");
    const ordinaryB = catalogItem("ordinary-b", "Ordinary B");

    expect(
      rankJwStoneCatalogForBrowse([ordinaryA, vagli, ordinaryB]).map((stone) => stone.id)
    ).toEqual(["supplier-vagli", "ordinary-a", "ordinary-b"]);
  });
});
