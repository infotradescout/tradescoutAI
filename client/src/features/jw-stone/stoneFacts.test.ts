import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import {
  availabilityDimensionsLine,
  confirmedFinishes,
  confirmedSlabCount,
  formatDimensionsForDisplay,
} from "./stoneFacts";
import type { JwStoneCatalogItem } from "./types";

describe("stoneFacts", () => {
  it("formats dimensions for editorial display", () => {
    expect(formatDimensionsForDisplay('133×78.5"')).toBe("133 × 78.5 in");
    expect(formatDimensionsForDisplay(null)).toBeNull();
  });

  it("shows customer-facing slab counts without inventing live availability or Dual Finish", () => {
    const blueDunes = JW_STONE_CATALOG.find((stone) => stone.id === "blue-dunes");
    expect(blueDunes).toBeTruthy();
    if (!blueDunes) throw new Error("Expected blue-dunes");

    expect(confirmedSlabCount(blueDunes)).toBe(8);
    expect(availabilityDimensionsLine(blueDunes)).toMatch(/^Slab count: 8/);
    expect(availabilityDimensionsLine(blueDunes)).not.toMatch(
      /source|confirmed|verified|available|in stock/i
    );
    expect(confirmedFinishes({ ...blueDunes, finishes: ["Dual Finish", "Polished"] })).toEqual([
      "Polished",
    ]);
    expect(
      confirmedFinishes({ ...blueDunes, finishStatus: "unconfirmed", finishes: ["Polished"] })
    ).toEqual([]);
  });

  it.each([
    { counts: undefined, dimensions: null, expected: "" },
    { counts: [], dimensions: null, expected: "" },
    { counts: [0], dimensions: null, expected: "" },
    { counts: undefined, dimensions: '120×60"', expected: "120 × 60 in" },
    { counts: [1], dimensions: null, expected: "Slab count: 1" },
    { counts: [3, 5], dimensions: null, expected: "Slab count: 8" },
    { counts: [8], dimensions: '120×60"', expected: "Slab count: 8 · 120 × 60 in" },
  ])("keeps the supplied facts for $expected without inventing missing details", ({ counts, dimensions, expected }) => {
    const stone = {
      sourceEvidence: counts === undefined ? undefined : { counts },
      slabDimensions: dimensions,
    } as JwStoneCatalogItem;

    expect(availabilityDimensionsLine(stone)).toBe(expected);
    expect(availabilityDimensionsLine(stone)).not.toMatch(
      /source|confirmed|verified|available|in stock|out of stock/i
    );
  });
});
