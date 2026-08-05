import { describe, expect, it } from "vitest";
import {
  COLOR_SWATCH_OPTIONS,
  countForColorSwatch,
  isColorSwatchActive,
  selectionForColorSwatch,
} from "./ColorPaletteRail";
import { JW_STONE_CATALOG } from "./catalog";

describe("JW Stone compact color swatch selector", () => {
  it("maps shopper labels to real aesthetic/color filter keys with inventory", () => {
    const mapping = Object.fromEntries(
      COLOR_SWATCH_OPTIONS.map((option) => [
        option.label,
        {
          id: option.id,
          aesthetic: option.aesthetic,
          color: option.color,
          count: countForColorSwatch(option, JW_STONE_CATALOG),
        },
      ])
    );

    expect(mapping["All"]).toMatchObject({ aesthetic: null, color: null });
    expect(mapping["All"]!.count).toBe(JW_STONE_CATALOG.length);
    expect(mapping["White & light"]).toMatchObject({ aesthetic: "soft-light", color: null });
    expect(mapping["Warm neutrals"]).toMatchObject({ aesthetic: "warm-earthy", color: null });
    expect(mapping["Gray & silver"]).toMatchObject({ aesthetic: null, color: "gray" });
    expect(mapping["Black & dramatic"]).toMatchObject({
      aesthetic: "deep-dramatic",
      color: null,
    });
    expect(mapping["Brown & earth"]).toMatchObject({ aesthetic: null, color: "brown" });
    expect(mapping["Green"]).toMatchObject({ aesthetic: null, color: "green" });
    expect(mapping["Blue"]).toMatchObject({ aesthetic: null, color: "blue" });
    expect(mapping["Red & burgundy"]).toMatchObject({ aesthetic: null, color: "rose" });
    expect(mapping["Multicolor"]).toMatchObject({ aesthetic: "bold-expressive", color: null });

    for (const option of COLOR_SWATCH_OPTIONS) {
      if (option.id === "all") continue;
      expect(countForColorSwatch(option, JW_STONE_CATALOG)).toBeGreaterThan(0);
    }
  });

  it("treats All as default and toggles back to cleared filters", () => {
    expect(
      isColorSwatchActive(
        { id: "all", aesthetic: null, color: null },
        { aesthetic: null, color: null }
      )
    ).toBe(true);
    expect(
      isColorSwatchActive(
        { id: "warm-neutrals", aesthetic: "warm-earthy", color: null },
        { aesthetic: "warm-earthy", color: null }
      )
    ).toBe(true);
    expect(
      isColorSwatchActive(
        { id: "green", aesthetic: null, color: "green" },
        { aesthetic: null, color: "green" }
      )
    ).toBe(true);
    expect(selectionForColorSwatch({ id: "green", aesthetic: null, color: "green" }, true)).toEqual(
      { aesthetic: null, color: null }
    );
    expect(
      selectionForColorSwatch({ id: "warm-neutrals", aesthetic: "warm-earthy", color: null }, false)
    ).toEqual({ aesthetic: "warm-earthy", color: null });
  });
});
