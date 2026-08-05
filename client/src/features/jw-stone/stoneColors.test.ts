import { describe, expect, it } from "vitest";
import {
  derivePairingSwatches,
  getColorsForStone,
  getPairingSwatchesForStone,
  getSwatchesForStone,
  isStoneColorId,
} from "./stoneColors";

describe("JW Stone photographed color palettes", () => {
  it("does not derive colors from stone display names or slug tokens", () => {
    // Name contains "White" / "Green" / "Black" — palette must still come from photo data.
    const dallas = getColorsForStone("dallas-white");
    const amazonic = getColorsForStone("amazonic-green");
    const blackPearl = getColorsForStone("black-pearl");
    const cristallo = getColorsForStone("cristallo");

    expect(dallas.length).toBeGreaterThan(0);
    expect(amazonic).toContain("green");
    expect(blackPearl.length).toBeGreaterThan(0);
    expect(cristallo.length).toBeGreaterThan(0);

    // Cristallo has no color word in the name; still has photo buckets.
    expect(cristallo).not.toEqual([]);
  });

  it("exposes adaptive 3–5 hex swatches from the cover photograph", () => {
    const spotlight = [
      "arizona-gold",
      "amazonic-green",
      "cristallo",
      "blue-dunes",
      "steel-gray",
      "gold-macaubas",
    ];
    for (const slug of spotlight) {
      const swatches = getSwatchesForStone(slug);
      expect(swatches.length, slug).toBeGreaterThanOrEqual(3);
      expect(swatches.length, slug).toBeLessThanOrEqual(5);
      for (const swatch of swatches) {
        expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/i);
        expect(isStoneColorId(swatch.bucket)).toBe(true);
      }
    }
  });

  it("spot-check: spotlight stones keep expected visual buckets", () => {
    expect(getColorsForStone("amazonic-green")).toEqual(expect.arrayContaining(["green", "white"]));
    expect(getColorsForStone("arizona-gold")).toEqual(expect.arrayContaining(["black", "gold"]));
    // Blue Dunes reads cool gray in yard photos — not a name-derived "blue".
    expect(getColorsForStone("blue-dunes")).toContain("gray");
    expect(getColorsForStone("steel-gray")).toEqual(expect.arrayContaining(["gray", "blue"]));
    expect(getColorsForStone("cristallo")).toEqual(expect.arrayContaining(["beige", "black"]));
  });

  it("derives soft pairing swatches from stone hues (not from photo sampling)", () => {
    const pairings = derivePairingSwatches(["#2a2418", "#c4a35a", "#ebe6d8"]);
    expect(pairings.length).toBeGreaterThan(0);
    expect(pairings.length).toBeLessThanOrEqual(4);
    for (const hex of pairings) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      // Pairings should not simply echo the source palette.
      expect(["#2a2418", "#c4a35a", "#ebe6d8"]).not.toContain(hex);
    }

    const fromStone = getPairingSwatchesForStone("arizona-gold");
    expect(fromStone.length).toBeGreaterThan(0);
  });

  it("accepts only vocabulary color ids", () => {
    expect(isStoneColorId("white")).toBe(true);
    expect(isStoneColorId("warm-earthy")).toBe(false);
  });
});
