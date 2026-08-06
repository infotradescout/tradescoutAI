// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLOR_SWATCH_OPTIONS } from "./ColorPaletteRail";
import {
  getMaterialRailItems,
  MATERIAL_RAIL_COVER_IMAGES,
  MATERIAL_RAIL_COVER_STONE_IDS,
  MaterialCategoryRail,
} from "./MaterialCategoryRail";
import { filterJwStoneCatalog, getCatalogItemById } from "./catalog";
import { isHandScaleCoverImage } from "./coverImages";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("MaterialCategoryRail", () => {
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

  it("exposes every filterable material with a real catalog cover and stones", () => {
    const items = getMaterialRailItems();
    expect(items.map((item) => item.materialId)).toEqual([
      "granite",
      "marble",
      "quartzite",
      "quartz",
      "onyx",
      "soapstone",
      "basalt",
    ]);
    expect(items.every((item) => item.count > 0)).toBe(true);
    expect(items.every((item) => item.stones.length === item.count)).toBe(true);
    expect(items.every((item) => Boolean(item.coverSrc))).toBe(true);
    expect(items.some((item) => item.materialId === "unconfirmed")).toBe(false);

    for (const [materialId, stoneId] of Object.entries(MATERIAL_RAIL_COVER_STONE_IDS)) {
      const stone = getCatalogItemById(stoneId);
      expect(stone?.materialId).toBe(materialId);
      expect(items.find((item) => item.materialId === materialId)?.coverSrc).toBe(
        MATERIAL_RAIL_COVER_IMAGES[materialId]
      );
      expect(MATERIAL_RAIL_COVER_IMAGES[materialId]).toContain("/material-covers/");
      // Dedicated face covers are not raw inventory-source leads (hands / clamps).
      expect(items.find((item) => item.materialId === materialId)?.coverSrc).not.toContain(
        "/inventory-source/"
      );
      if (stone?.images[0]) {
        expect(isHandScaleCoverImage(stone.images[0])).toBe(false);
      }
    }
  });

  it("stays collapsed in page IA until opened, then expands a paged stone viewer", () => {
    const onSelect = vi.fn();
    const noop = vi.fn();
    act(() =>
      root.render(
        <MaterialCategoryRail
          active={null}
          onSelect={onSelect}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={noop}
          onAsk={noop}
        />
      )
    );

    expect(container.textContent).toContain("Browse by material");
    expect(
      container.querySelector('[data-testid="jw-material-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-material-stack"]')).toBeNull();

    act(() =>
      container
        .querySelector('[data-testid="jw-material-rail-toggle"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(container.querySelector('[data-testid="jw-material-stack"]')?.className).toMatch(
      /flex-col/
    );
    expect(container.querySelector('[data-testid="jw-material-stone-rail"]')).toBeNull();

    const granite = container.querySelector('[data-testid="jw-material-granite"]');
    expect(granite?.querySelector("img")?.getAttribute("src")).toContain(
      "/material-covers/granite"
    );
    expect(granite?.querySelector("img")?.className).toMatch(/object-cover/);
    act(() => granite?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith("granite");

    act(() =>
      root.render(
        <MaterialCategoryRail
          active="granite"
          onSelect={onSelect}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={noop}
          onAsk={noop}
        />
      )
    );

    expect(
      container.querySelector('[data-testid="jw-material-rail"]')?.getAttribute("data-expanded")
    ).toBe("true");
    const rail = container.querySelector('[data-testid="jw-material-stone-rail"]');
    expect(rail).not.toBeNull();
    expect(rail?.querySelector('[data-testid="jw-material-stone-prev"]')).not.toBeNull();
    expect(rail?.querySelector('[data-testid="jw-material-stone-next"]')).not.toBeNull();
    expect(rail?.className).not.toMatch(/overflow-x-auto/);
    expect(rail?.querySelectorAll("[data-stone-card]").length).toBe(1);
    expect(rail?.querySelector("img")?.className).toMatch(/object-contain/);
  });

  it("exposes color refine chips once a material is active (no All chip)", () => {
    const onSelect = vi.fn();
    const onSelectColor = vi.fn();
    const noop = vi.fn();

    act(() =>
      root.render(
        <MaterialCategoryRail
          active={null}
          onSelect={onSelect}
          onSelectColor={onSelectColor}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={noop}
          onAsk={noop}
        />
      )
    );
    act(() =>
      container
        .querySelector('[data-testid="jw-material-rail-toggle"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(container.querySelector('[data-testid="jw-material-color-chip-row"]')).toBeNull();

    act(() =>
      root.render(
        <MaterialCategoryRail
          active="granite"
          onSelect={onSelect}
          onSelectColor={onSelectColor}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={noop}
          onAsk={noop}
        />
      )
    );

    expect(
      container.querySelector('[data-testid="jw-material-color-refine-granite"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="jw-material-color-prompt"]')?.textContent
    ).toContain("Refine by color");
    const row = container.querySelector('[data-testid="jw-material-color-chip-row"]');
    expect(row).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-material-color-all"]')).toBeNull();

    for (const option of COLOR_SWATCH_OPTIONS) {
      expect(
        container.querySelector(`[data-testid="jw-material-color-${option.id}"]`)
      ).not.toBeNull();
    }

    const green = container.querySelector('[data-testid="jw-material-color-green"]');
    act(() => green?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onSelectColor).toHaveBeenCalledWith({ aesthetic: null, color: "green" });
  });

  it("refines the active material stone pager when color is applied", () => {
    const noop = vi.fn();
    const graniteAll = getMaterialRailItems().find((item) => item.materialId === "granite");
    expect(graniteAll?.count).toBeGreaterThan(1);

    const greenGranite = filterJwStoneCatalog({ material: "granite", color: "green" });
    expect(greenGranite.length).toBeGreaterThan(0);
    expect(greenGranite.length).toBeLessThan(graniteAll!.count);

    act(() =>
      root.render(
        <MaterialCategoryRail
          active="granite"
          color="green"
          onSelect={noop}
          onSelectColor={noop}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={noop}
          onAsk={noop}
        />
      )
    );

    const greenChip = container.querySelector('[data-testid="jw-material-color-green"]');
    expect(greenChip?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-testid="jw-material-stone-status"]')?.textContent).toBe(
      `Granite · 1 of ${greenGranite.length}`
    );
    expect(container.querySelector('[data-testid="jw-material-color-empty"]')).toBeNull();
  });
});
