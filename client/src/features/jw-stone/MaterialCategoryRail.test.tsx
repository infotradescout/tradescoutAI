// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("exposes every filterable material including Onyx with a real catalog cover and stones", () => {
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
    expect(items.find((item) => item.materialId === "onyx")).toMatchObject({
      materialLabel: "Onyx",
    });
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

  it("stays collapsed on mount even when a material is already active", () => {
    const noop = vi.fn();
    act(() =>
      root.render(
        <MaterialCategoryRail
          active="granite"
          onSelect={noop}
          isSaved={() => false}
          onToggleSaved={noop}
          onOpen={noop}
          onAsk={noop}
        />
      )
    );

    expect(
      container.querySelector('[data-testid="jw-material-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-material-stack"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-stone-rail"]')).toBeNull();
  });

  it("uses a compact mobile-first grid and places active results below every category", () => {
    const noop = vi.fn();
    act(() =>
      root.render(
        <MaterialCategoryRail
          active="granite"
          onSelect={noop}
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

    const materialGrid = container.querySelector<HTMLElement>('[data-testid="jw-material-stack"]');
    const activeResults = container.querySelector<HTMLElement>(
      '[data-testid="jw-material-stone-rail-granite"]'
    );
    expect(materialGrid?.className).toMatch(/\bgrid\b/);
    expect(materialGrid?.className).toMatch(/grid-cols-2/);
    expect(materialGrid?.className).toMatch(/sm:grid-cols-3/);
    expect(materialGrid?.className).toMatch(/lg:grid-cols-4/);
    expect(materialGrid?.className).toMatch(/xl:grid-cols-7/);
    expect(activeResults?.previousElementSibling).toBe(materialGrid);
    expect(
      container.querySelector('[data-testid="jw-material-granite"]')?.getAttribute("aria-controls")
    ).toBe(activeResults?.id);
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

    expect(container.textContent).toContain("Browse by Material");
    expect(
      container.querySelector('[data-testid="jw-material-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-material-stack"]')).toBeNull();

    act(() =>
      container
        .querySelector('[data-testid="jw-material-rail-toggle"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    const materialGrid = container.querySelector<HTMLElement>('[data-testid="jw-material-stack"]');
    expect(materialGrid?.className).toMatch(/\bgrid\b/);
    expect(materialGrid?.className).toMatch(/grid-cols-2/);
    expect(materialGrid?.className).toMatch(/sm:grid-cols-3/);
    expect(materialGrid?.className).toMatch(/lg:grid-cols-4/);
    expect(materialGrid?.className).toMatch(/xl:grid-cols-7/);
    expect(materialGrid?.className).not.toMatch(/flex-col/);
    expect(container.querySelector('[data-testid="jw-material-stone-rail"]')).toBeNull();

    const granite = container.querySelector('[data-testid="jw-material-granite"]');
    expect(granite?.querySelector("img")?.getAttribute("src")).toContain(
      "/material-covers/granite"
    );
    expect(granite?.querySelector("img")?.className).toMatch(/object-cover/);
    expect(granite?.querySelector("span")?.className).toMatch(/aspect-\[4\/3\]/);
    expect(granite?.querySelector("span")?.className).toMatch(/min-h-\[7rem\]/);
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
    const track = rail?.querySelector('[data-testid="jw-material-stone-track"]');
    expect(track?.className).toMatch(/overflow-x-auto/);
    expect(track?.className).not.toMatch(/snap-/);
    expect(rail?.querySelectorAll("[data-stone-card]").length).toBeGreaterThan(1);
    expect(rail?.querySelector("img")?.className).toMatch(/object-cover/);
    expect(rail?.querySelector("img")?.className).not.toMatch(/object-contain/);
  });

  it("shows material stones immediately without a color pick gate", () => {
    const onSelect = vi.fn();
    const noop = vi.fn();
    const graniteAll = getMaterialRailItems().find((item) => item.materialId === "granite");
    expect(graniteAll?.count).toBeGreaterThan(1);

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
    act(() =>
      container
        .querySelector('[data-testid="jw-material-rail-toggle"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );

    expect(container.querySelector('[data-testid="jw-material-color-refine-granite"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-color-prompt"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-color-chip-row"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="jw-material-stone-rail-granite"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-material-stone-status"]')?.textContent).toBe(
      `Granite · 1 of ${graniteAll!.count}`
    );
  });

  it("keeps Onyx listed with full stature even when an unrelated color refine is active", () => {
    const base = getMaterialRailItems().find((item) => item.materialId === "onyx");
    expect(base?.count).toBeGreaterThan(0);

    const items = getMaterialRailItems(undefined, { color: "blue" });
    expect(items.map((item) => item.materialId)).toEqual([
      "granite",
      "marble",
      "quartzite",
      "quartz",
      "onyx",
      "soapstone",
      "basalt",
    ]);
    const onyx = items.find((item) => item.materialId === "onyx");
    expect(onyx?.coverSrc).toContain("/material-covers/onyx");
    // Blue refine may empty the pager stones, but the tile count stays full-catalog.
    expect(onyx?.count).toBe(base?.count);
    expect(onyx?.stones.length).toBeLessThanOrEqual(base!.count);
  });

  it("opens Onyx stones without requiring a color selection", () => {
    const noop = vi.fn();
    const onyxAll = getMaterialRailItems().find((item) => item.materialId === "onyx");
    expect(onyxAll?.count).toBeGreaterThan(0);

    act(() =>
      root.render(
        <MaterialCategoryRail
          active="onyx"
          onSelect={noop}
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

    expect(container.querySelector('[data-testid="jw-material-onyx"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-material-color-refine-onyx"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-stone-status"]')?.textContent).toBe(
      `Onyx · 1 of ${onyxAll!.count}`
    );
  });

  it("can still scope an active material's pager when color is already in URL state", () => {
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
    expect(container.querySelector('[data-testid="jw-material-stone-status"]')?.textContent).toBe(
      `Granite · 1 of ${greenGranite.length}`
    );
  });
});
