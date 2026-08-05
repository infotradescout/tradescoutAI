import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import {
  availabilityDimensionsLine,
  confirmedFinishes,
  confirmedSlabCount,
  formatDimensionsForDisplay,
} from "./stoneFacts";

describe("stoneFacts", () => {
  it("formats dimensions for editorial display", () => {
    expect(formatDimensionsForDisplay('133×78.5"')).toBe("133 × 78.5 in");
    expect(formatDimensionsForDisplay(null)).toBeNull();
  });

  it("surfaces confirmed slab counts without inventing Dual Finish", () => {
    const blueDunes = JW_STONE_CATALOG.find((stone) => stone.id === "blue-dunes");
    expect(blueDunes).toBeTruthy();
    if (!blueDunes) throw new Error("Expected blue-dunes");

    expect(confirmedSlabCount(blueDunes)).toBe(8);
    expect(availabilityDimensionsLine(blueDunes)).toMatch(/8 slabs available/);
    expect(confirmedFinishes({ ...blueDunes, finishes: ["Dual Finish", "Polished"] })).toEqual([
      "Polished",
    ]);
    expect(
      confirmedFinishes({ ...blueDunes, finishStatus: "unconfirmed", finishes: ["Polished"] })
    ).toEqual([]);
  });
});
