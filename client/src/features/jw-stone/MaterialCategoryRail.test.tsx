// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMaterialRailItems,
  MATERIAL_RAIL_COVER_STONE_IDS,
  MaterialCategoryRail,
} from "./MaterialCategoryRail";
import { getCatalogItemById } from "./catalog";

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

  it("exposes every filterable material with a real catalog cover", () => {
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
    expect(items.every((item) => Boolean(item.coverSrc))).toBe(true);
    expect(items.some((item) => item.materialId === "unconfirmed")).toBe(false);

    for (const [materialId, stoneId] of Object.entries(MATERIAL_RAIL_COVER_STONE_IDS)) {
      const stone = getCatalogItemById(stoneId);
      expect(stone?.materialId).toBe(materialId);
      expect(items.find((item) => item.materialId === materialId)?.coverSrc).toBe(stone?.images[0]);
    }
  });

  it("toggles material selection without accordion chrome", () => {
    const onSelect = vi.fn();
    act(() => root.render(<MaterialCategoryRail active={null} onSelect={onSelect} />));

    expect(container.textContent).toContain("Browse by material");
    expect(container.textContent).toContain("Granite");
    expect(container.textContent).toContain("Marble");
    expect(container.textContent).toContain("Quartzite");
    expect(container.querySelector('[data-testid="jw-inventory-categories"]')).toBeNull();
    expect(container.querySelectorAll("details, summary").length).toBe(0);

    const granite = container.querySelector('[data-testid="jw-material-granite"]');
    expect(granite).not.toBeNull();
    act(() => granite?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith("granite");

    act(() => root.render(<MaterialCategoryRail active="granite" onSelect={onSelect} />));
    expect(
      container.querySelector('[data-testid="jw-material-granite"]')?.getAttribute("aria-pressed")
    ).toBe("true");
    act(() =>
      container
        .querySelector('[data-testid="jw-material-granite"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});
