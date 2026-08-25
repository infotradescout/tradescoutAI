import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import {
  getJwStoneTopSellerLabel,
  getJwStoneTopSellerRank,
  JW_STONE_TOP_SELLER_RANK_BY_SLUG,
} from "./topSellers";

describe("JW Stone top sellers", () => {
  it("locks the owner-confirmed ranking and labels", () => {
    expect(JW_STONE_TOP_SELLER_RANK_BY_SLUG).toEqual({
      "rhino-white": 1,
      "taj-mahal": 2,
      "bianco-carrara": 3,
    });

    expect(getJwStoneTopSellerRank("rhino-white")).toBe(1);
    expect(getJwStoneTopSellerLabel("rhino-white")).toBe("#1 Top Seller");
    expect(getJwStoneTopSellerLabel("taj-mahal")).toBe("Top Seller");
    expect(getJwStoneTopSellerLabel("bianco-carrara")).toBe("Top Seller");
    expect(getJwStoneTopSellerLabel("blue-dunes")).toBeNull();
  });

  it("maps every ranked slug to a real named JW Stone catalog item", () => {
    const namedIds = new Set(
      JW_STONE_CATALOG.filter((stone) => !stone.anonymous).map((stone) => stone.id)
    );

    expect([...Object.keys(JW_STONE_TOP_SELLER_RANK_BY_SLUG)].every((slug) => namedIds.has(slug))).toBe(
      true
    );
  });
});
