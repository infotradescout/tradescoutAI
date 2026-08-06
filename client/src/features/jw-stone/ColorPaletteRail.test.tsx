// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COLOR_SWATCH_OPTIONS,
  ColorPaletteRail,
  countForColorSwatch,
  isColorSwatchActive,
  selectionForColorSwatch,
} from "./ColorPaletteRail";
import { JW_STONE_CATALOG } from "./catalog";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const EXPECTED_COLOR_LABELS = [
  "White & light",
  "Warm neutrals",
  "Gray & silver",
  "Black",
  "Brown & earth",
  "Green",
  "Blue",
  "Red & burgundy",
  "Multicolor",
] as const;

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

    expect(Object.keys(mapping)).toEqual([...EXPECTED_COLOR_LABELS]);
    expect(mapping["All"]).toBeUndefined();
    expect(mapping["White & light"]).toMatchObject({ aesthetic: "soft-light", color: null });
    expect(mapping["Warm neutrals"]).toMatchObject({ aesthetic: "warm-earthy", color: null });
    expect(mapping["Gray & silver"]).toMatchObject({ aesthetic: null, color: "gray" });
    expect(mapping["Black"]).toMatchObject({
      aesthetic: "deep-dramatic",
      color: null,
    });
    expect(mapping["Brown & earth"]).toMatchObject({ aesthetic: null, color: "brown" });
    expect(mapping["Green"]).toMatchObject({ aesthetic: null, color: "green" });
    expect(mapping["Blue"]).toMatchObject({ aesthetic: null, color: "blue" });
    expect(mapping["Red & burgundy"]).toMatchObject({ aesthetic: null, color: "rose" });
    expect(mapping["Multicolor"]).toMatchObject({ aesthetic: "bold-expressive", color: null });

    for (const option of COLOR_SWATCH_OPTIONS) {
      expect(countForColorSwatch(option, JW_STONE_CATALOG)).toBeGreaterThan(0);
    }
  });

  it("uses stone-face collage cues instead of flat paint swatches", () => {
    for (const option of COLOR_SWATCH_OPTIONS) {
      if (option.faceSrc) {
        expect(option.faceSrc).toContain("/color-collage/");
        expect(option.faces).toBeNull();
      } else {
        expect(option.faces?.length).toBeGreaterThan(1);
        expect(option.faces!.every((src) => src.includes("/color-collage/"))).toBe(true);
      }
    }
  });

  it("has no All chip; re-click clears color filter", () => {
    expect(COLOR_SWATCH_OPTIONS.some((option) => option.id === "all")).toBe(false);
    expect(
      isColorSwatchActive(
        { aesthetic: "warm-earthy", color: null },
        { aesthetic: "warm-earthy", color: null }
      )
    ).toBe(true);
    expect(
      isColorSwatchActive({ aesthetic: null, color: "green" }, { aesthetic: null, color: "green" })
    ).toBe(true);
    expect(
      isColorSwatchActive(
        { aesthetic: "warm-earthy", color: null },
        { aesthetic: null, color: null }
      )
    ).toBe(false);
    expect(selectionForColorSwatch({ aesthetic: null, color: "green" }, true)).toEqual({
      aesthetic: null,
      color: null,
    });
    expect(selectionForColorSwatch({ aesthetic: "warm-earthy", color: null }, false)).toEqual({
      aesthetic: "warm-earthy",
      color: null,
    });
  });

  describe("ColorPaletteRail UI", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    const railHandlers = {
      isSaved: () => false,
      onToggleSaved: vi.fn(),
      onOpen: vi.fn(),
      onAsk: vi.fn(),
    };

    it("renders the full color set in a wrapping grid with no All chip", () => {
      const onSelect = vi.fn();
      act(() =>
        root.render(
          <ColorPaletteRail aesthetic={null} color={null} onSelect={onSelect} {...railHandlers} />
        )
      );

      // Collapsed until opened — expand to assert the full chip set.
      act(() => {
        container
          .querySelector('[data-testid="jw-palette-rail-toggle"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      const row = container.querySelector('[data-testid="jw-palette-chip-row"]');
      expect(row).not.toBeNull();
      expect(row?.className).toMatch(/grid/);
      expect(row?.className).toMatch(/grid-cols-3/);
      expect(row?.className).not.toMatch(/overflow-x-auto/);
      expect(row?.className).not.toMatch(/snap-x/);

      expect(container.querySelector('[data-testid="jw-palette-all"]')).toBeNull();
      expect(container.querySelector('[data-testid="jw-palette-prompt"]')).not.toBeNull();

      const expectedIds = [
        "white-light",
        "warm-neutrals",
        "gray-silver",
        "black-dramatic",
        "brown-earth",
        "green",
        "blue",
        "red-burgundy",
        "multicolor",
      ] as const;
      for (const id of expectedIds) {
        expect(container.querySelector(`[data-testid="jw-palette-${id}"]`)).not.toBeNull();
      }
      for (const label of EXPECTED_COLOR_LABELS) {
        expect(container.textContent).toContain(label);
      }
      expect(expectedIds).toHaveLength(EXPECTED_COLOR_LABELS.length);
    });

    it("renders stone-face chips with editorial labels and selection", () => {
      const onSelect = vi.fn();
      act(() =>
        root.render(
          <ColorPaletteRail
            aesthetic="warm-earthy"
            color={null}
            onSelect={onSelect}
            {...railHandlers}
          />
        )
      );

      expect(container.querySelector('[data-testid="jw-palette-prompt"]')).toBeNull();
      expect(container.querySelector('[data-testid="jw-palette-results"]')).not.toBeNull();
      expect(container.querySelector("[data-stone-card]")).not.toBeNull();
      expect(container.querySelector('[data-testid="jw-palette-results-heading"]')).toBeNull();

      const status = container.querySelector('[data-testid="jw-material-stone-status"]');
      expect(status?.textContent).toMatch(/^Warm neutrals · \d+ of \d+$/);
      // One status line only — no redundant "N … selections" / "N of M … selections" stack.
      expect(container.textContent).not.toMatch(/\d+ warm neutrals selections/i);
      expect(container.textContent).not.toMatch(/\d+ of \d+ warm neutrals selections/i);

      const warm = container.querySelector('[data-testid="jw-palette-warm-neutrals"]');
      expect(warm?.getAttribute("aria-pressed")).toBe("true");
      expect(warm?.querySelector("img")?.getAttribute("src")).toContain("/color-collage/02-warm");
      expect(warm?.textContent).toContain("Warm neutrals");
      expect(warm?.className).not.toMatch(/bg-\[var\(--jw-accent\)\]/);

      const green = container.querySelector('[data-testid="jw-palette-green"]');
      expect(green?.querySelector("img")?.getAttribute("src")).toContain("/color-collage/06-green");

      act(() => {
        green?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(onSelect).toHaveBeenCalledWith({ aesthetic: null, color: "green" });
    });
  });
});
