// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COLOR_SWATCH_OPTIONS,
  ColorPaletteRail,
  MOOD_SWATCH_OPTIONS,
  MoodPaletteRail,
  PALETTE_RAIL_DIRECTIONS,
  countForColorSwatch,
  isColorSwatchActive,
  selectionForColorSwatch,
} from "./ColorPaletteRail";
import { JW_STONE_CATALOG } from "./catalog";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const EXPECTED_COLOR_LABELS = [
  "White",
  "Beige",
  "Gray",
  "Black",
  "Brown",
  "Gold",
  "Green",
  "Blue",
] as const;

describe("JW Stone compact color swatch selector", () => {
  it("maps every shopper label to the same literal catalog color with inventory", () => {
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
    expect(mapping["White"]).toMatchObject({ aesthetic: null, color: "white" });
    expect(mapping["Beige"]).toMatchObject({ aesthetic: null, color: "beige" });
    expect(mapping["Gray"]).toMatchObject({ aesthetic: null, color: "gray" });
    expect(mapping["Black"]).toMatchObject({ aesthetic: null, color: "black" });
    expect(mapping["Brown"]).toMatchObject({ aesthetic: null, color: "brown" });
    expect(mapping["Gold"]).toMatchObject({ aesthetic: null, color: "gold" });
    expect(mapping["Green"]).toMatchObject({ aesthetic: null, color: "green" });
    expect(mapping["Blue"]).toMatchObject({ aesthetic: null, color: "blue" });

    for (const option of COLOR_SWATCH_OPTIONS) {
      expect(option.aesthetic).toBeNull();
      expect(option.color).not.toBeNull();
      const namedMatches = JW_STONE_CATALOG.filter(
        (stone) => !stone.anonymous && stone.colors.includes(option.color!)
      );
      const representative = JW_STONE_CATALOG.find(
        (stone) => stone.id === option.representativeStoneId
      );
      expect(countForColorSwatch(option, JW_STONE_CATALOG)).toBe(namedMatches.length);
      expect(namedMatches.length).toBeGreaterThan(0);
      expect(representative?.anonymous).toBe(false);
      expect(representative?.colors).toContain(option.color);
    }
  });

  it("uses stone-face collage cues instead of flat paint swatches", () => {
    for (const option of COLOR_SWATCH_OPTIONS) {
      expect(option.faceSrc).toContain("/color-collage/");
      expect(option.faces).toBeNull();
    }
  });

  it("has no All chip; re-click clears color filter", () => {
    expect(COLOR_SWATCH_OPTIONS.map((option) => option.id as string)).not.toContain("all");
    expect(
      isColorSwatchActive({ aesthetic: null, color: "beige" }, { aesthetic: null, color: "beige" })
    ).toBe(true);
    expect(
      isColorSwatchActive({ aesthetic: null, color: "green" }, { aesthetic: null, color: "green" })
    ).toBe(true);
    expect(
      isColorSwatchActive({ aesthetic: null, color: "beige" }, { aesthetic: null, color: null })
    ).toBe(false);
    expect(selectionForColorSwatch({ aesthetic: null, color: "green" }, true)).toEqual({
      aesthetic: null,
      color: null,
    });
    expect(selectionForColorSwatch({ aesthetic: null, color: "beige" }, false)).toEqual({
      aesthetic: null,
      color: "beige",
    });
  });

  it("preserves editorial mood browsing outside the literal color picker", () => {
    expect(MOOD_SWATCH_OPTIONS.map((option) => option.id)).toEqual([
      "soft-light",
      "warm-earthy",
      "deep-dramatic",
      "bold-expressive",
    ]);
    expect(PALETTE_RAIL_DIRECTIONS).toEqual(
      MOOD_SWATCH_OPTIONS.map((option) => ({
        id: option.aesthetic,
        label: option.label,
        coverStoneId: option.representativeStoneId,
      }))
    );

    for (const option of MOOD_SWATCH_OPTIONS) {
      expect(option.aesthetic).not.toBeNull();
      expect(option.color).toBeNull();
      expect(countForColorSwatch(option, JW_STONE_CATALOG)).toBeGreaterThan(0);
      expect(
        JW_STONE_CATALOG.find((stone) => stone.id === option.representativeStoneId)?.colorDirection
      ).toBe(option.aesthetic);
    }
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
        "white",
        "beige",
        "gray",
        "black",
        "brown",
        "gold",
        "green",
        "blue",
      ] as const;
      for (const id of expectedIds) {
        expect(container.querySelector(`[data-testid="jw-palette-${id}"]`)).not.toBeNull();
      }
      for (const label of EXPECTED_COLOR_LABELS) {
        expect(container.textContent).toContain(label);
      }
      expect(expectedIds).toHaveLength(EXPECTED_COLOR_LABELS.length);
    });

    it("stays collapsed on mount even when a color filter is already set", () => {
      const onSelect = vi.fn();
      act(() =>
        root.render(
          <ColorPaletteRail aesthetic={null} color="beige" onSelect={onSelect} {...railHandlers} />
        )
      );

      expect(
        container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
      ).toBe("false");
      expect(container.querySelector('[data-testid="jw-palette-results"]')).toBeNull();
      expect(container.querySelector('[data-testid="jw-palette-chip-row"]')).toBeNull();
    });

    it("does not present a legacy mood filter as a literal color", () => {
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

      act(() => {
        container
          .querySelector('[data-testid="jw-palette-rail-toggle"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(container.querySelector('[data-testid="jw-palette-prompt"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="jw-palette-results"]')).toBeNull();
      expect(container.querySelector('[aria-pressed="true"]')).toBeNull();
    });

    it("renders stone-face chips with editorial labels and selection", () => {
      const onSelect = vi.fn();
      act(() =>
        root.render(
          <ColorPaletteRail aesthetic={null} color="beige" onSelect={onSelect} {...railHandlers} />
        )
      );

      act(() => {
        container
          .querySelector('[data-testid="jw-palette-rail-toggle"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(container.querySelector('[data-testid="jw-palette-prompt"]')).toBeNull();
      expect(container.querySelector('[data-testid="jw-palette-results"]')).not.toBeNull();
      expect(container.querySelector("[data-stone-card]")).not.toBeNull();
      expect(container.querySelector('[data-testid="jw-palette-results-heading"]')).toBeNull();

      const status = container.querySelector('[data-testid="jw-material-stone-status"]');
      expect(status?.textContent).toMatch(/^Beige · \d+ of \d+$/);
      // One status line only — no redundant "N … selections" / "N of M … selections" stack.
      expect(container.textContent).not.toMatch(/\d+ warm neutrals selections/i);
      expect(container.textContent).not.toMatch(/\d+ of \d+ warm neutrals selections/i);

      const beige = container.querySelector('[data-testid="jw-palette-beige"]');
      expect(beige?.getAttribute("aria-pressed")).toBe("true");
      expect(beige?.querySelector("img")?.getAttribute("src")).toContain("/color-collage/02-warm");
      expect(beige?.querySelector("img")?.getAttribute("src")).toContain("v=face-5");
      expect(beige?.textContent).toContain("Beige");
      expect(beige?.className).not.toMatch(/bg-\[var\(--jw-accent\)\]/);

      const green = container.querySelector('[data-testid="jw-palette-green"]');
      expect(green?.querySelector("img")?.getAttribute("src")).toContain("/color-collage/06-green");

      act(() => {
        green?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(onSelect).toHaveBeenCalledWith({ aesthetic: null, color: "green" });
    });

    it("renders mood choices separately and writes aesthetic instead of color", () => {
      const onSelect = vi.fn();
      act(() =>
        root.render(<MoodPaletteRail aesthetic={null} onSelect={onSelect} {...railHandlers} />)
      );

      expect(
        container.querySelector('[data-testid="jw-mood-rail"]')?.getAttribute("data-expanded")
      ).toBe("false");
      expect(
        container
          .querySelector('[data-testid="jw-mood-rail-toggle"] img')
          ?.getAttribute("src")
      ).toContain("/story/mont-blanc-bar.webp");
      act(() => {
        container
          .querySelector('[data-testid="jw-mood-rail-toggle"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(container.querySelector('[data-testid="jw-mood-chip-row"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="jw-palette-white"]')).toBeNull();
      for (const option of MOOD_SWATCH_OPTIONS) {
        expect(container.querySelector(`[data-testid="jw-mood-${option.id}"]`)).not.toBeNull();
        expect(container.textContent).toContain(option.label);
      }

      act(() => {
        container
          .querySelector('[data-testid="jw-mood-warm-earthy"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(onSelect).toHaveBeenCalledWith({ aesthetic: "warm-earthy", color: null });
    });

    it("restores an aesthetic deep link when the mood section is opened", () => {
      const onSelect = vi.fn();
      act(() =>
        root.render(
          <MoodPaletteRail aesthetic="bold-expressive" onSelect={onSelect} {...railHandlers} />
        )
      );

      act(() => {
        container
          .querySelector('[data-testid="jw-mood-rail-toggle"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(
        container
          .querySelector('[data-testid="jw-mood-bold-expressive"]')
          ?.getAttribute("aria-pressed")
      ).toBe("true");
      expect(container.querySelector('[data-testid="jw-mood-results"]')).not.toBeNull();
      expect(
        container.querySelector('[data-testid="jw-material-stone-status"]')?.textContent
      ).toMatch(/^Bold & Expressive · \d+ of \d+$/);
    });
  });
});
