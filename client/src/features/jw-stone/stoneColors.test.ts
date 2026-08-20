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

  it("face-true overrides restore hue washed out by yard/floor/sky sampling", () => {
    expect(getColorsForStone("mexican-brown")).toEqual(expect.arrayContaining(["brown"]));
    expect(getColorsForStone("chocolate-brown")).toEqual(expect.arrayContaining(["brown"]));
    expect(getColorsForStone("dueto")).toEqual(expect.arrayContaining(["brown"]));
    expect(getColorsForStone("pinta-verde")).toEqual(expect.arrayContaining(["green"]));
    expect(getColorsForStone("blue-bahia")).toEqual(expect.arrayContaining(["blue"]));
    expect(getColorsForStone("emerald-pearl")).toEqual(expect.arrayContaining(["green"]));
    expect(getColorsForStone("preto-sao-gabriel")).toEqual(
      expect.arrayContaining(["black"])
    );
    expect(getColorsForStone("venta-black")).toEqual(expect.arrayContaining(["black"]));
    expect(getColorsForStone("emperor-brown")).toEqual(expect.arrayContaining(["brown"]));
    expect(getColorsForStone("fusion-yellow")).toEqual(expect.arrayContaining(["yellow", "gold"]));
  });

  it("Alabama White stays white/gray — never blue (yard/sky wash)", () => {
    const colors = getColorsForStone("alabama-white");
    expect(colors).toEqual(expect.arrayContaining(["white"]));
    expect(colors).not.toContain("blue");
    expect(getColorsForStone("dallas-white")).not.toContain("blue");
    expect(getColorsForStone("namib-fantasy")).not.toContain("blue");
  });

  it("Black Pearl swatches stay on the dark stone face (no cream / crane yellow)", () => {
    const swatches = getSwatchesForStone("black-pearl");
    expect(swatches.length).toBeGreaterThanOrEqual(3);
    expect(getColorsForStone("black-pearl")).toEqual(expect.arrayContaining(["gray"]));
    for (const swatch of swatches) {
      const hex = swatch.hex;
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / (2 * 255);
      const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
      // No pale cream / industrial yellow from yard equipment or gravel.
      expect(l, hex).toBeLessThan(0.55);
      expect(!(s > 0.4 && l > 0.35), hex).toBe(true);
    }
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

  it("dark stones pair with warm neutrals / soft white / muted metal — not pastel teal/lavender", () => {
    const pairings = derivePairingSwatches(["#0d0000", "#484844", "#757268"]);
    expect(pairings.length).toBeGreaterThanOrEqual(3);
    for (const hex of pairings) {
      const r = Number.parseInt(hex.slice(1, 3), 16);
      const g = Number.parseInt(hex.slice(3, 5), 16);
      const b = Number.parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / (2 * 255);
      const d = max - min;
      const s = max === 0 ? 0 : d / max;
      // Reject high-chroma cool pastels (teal / lavender theory garbage).
      const coolHue = b >= g && b >= r && max > min ? true : g >= r && g >= b && b > r;
      expect(!(coolHue && s > 0.22 && l > 0.45 && l < 0.85), hex).toBe(true);
    }

    const fromStone = getPairingSwatchesForStone("black-pearl");
    expect(fromStone.length).toBeGreaterThan(0);
    expect(fromStone.length).toBeLessThanOrEqual(4);
  });

  it("accepts only vocabulary color ids", () => {
    expect(isStoneColorId("white")).toBe(true);
    expect(isStoneColorId("warm-earthy")).toBe(false);
  });
});
