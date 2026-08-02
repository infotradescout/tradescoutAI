import { describe, expect, it } from "vitest";
import {
  JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT,
  sanitizeJwStoneDirectConnectSelections,
} from "@shared/jwStoneDirectConnect";

describe("JW Stone Direct Connect selection safety", () => {
  it("deduplicates named selections and rejects anonymous or malformed context", () => {
    expect(
      sanitizeJwStoneDirectConnectSelections({
        profileSlug: "jw-stone",
        selections: [
          { itemId: "amazonic-green", stoneName: "Amazonic Green" },
          { itemId: "amazonic-green", stoneName: "Amazonic Green" },
          { itemId: "trending-selection-05", stoneName: "Trending Selection 05" },
          { itemId: "not a slug", stoneName: "Unsafe" },
          { itemId: "steel-gray", stoneName: "Steel Gray" },
        ],
      })
    ).toEqual([
      { itemId: "amazonic-green", stoneName: "Amazonic Green" },
      { itemId: "steel-gray", stoneName: "Steel Gray" },
    ]);
  });

  it("fails closed outside the JW profile and enforces the maximum", () => {
    const selections = Array.from(
      { length: JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT + 10 },
      (_, index) => ({ itemId: `stone-${index + 1}`, stoneName: `Stone ${index + 1}` })
    );

    expect(
      sanitizeJwStoneDirectConnectSelections({ profileSlug: "another-profile", selections })
    ).toEqual([]);
    expect(
      sanitizeJwStoneDirectConnectSelections({ profileSlug: "jw-stone", selections })
    ).toHaveLength(JW_STONE_DIRECT_CONNECT_SELECTION_LIMIT);
  });
});
