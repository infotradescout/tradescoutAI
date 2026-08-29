// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  COLOR_RANGE_SLICES,
  COLOR_RANGE_STONE_DEFS,
  ColorCollageBackground,
} from "./ColorCollageBackground";
import { MarketplaceIntroduction } from "./MarketplaceIntroduction";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("JW Stone requested visual scope", () => {
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

  it("keeps the approved hero headline visible and hides only the supporting subtext", () => {
    act(() => root.render(<MarketplaceIntroduction />));

    const title = container.querySelector<HTMLElement>("#jw-marketplace-title");
    const subtext = container.querySelector<HTMLElement>(
      '[data-testid="jw-marketplace-local-description"]'
    );

    expect(title?.textContent).toContain("Natural stone, selected at the source.");
    expect(title?.className).not.toContain("sr-only");
    expect(subtext?.className).toContain("sr-only");
  });

  it("shows a deliberate full-spectrum range using one real stone photo per equal slice", () => {
    expect(COLOR_RANGE_STONE_DEFS.map((slice) => slice.colorFamily)).toEqual([
      "white",
      "crystal",
      "rose",
      "gold",
      "green",
      "blue",
      "earth",
      "black",
    ]);
    expect(COLOR_RANGE_SLICES).toHaveLength(8);
    expect(new Set(COLOR_RANGE_SLICES.map((slice) => slice.stoneId)).size).toBe(8);
    expect(COLOR_RANGE_SLICES.every((slice) => Boolean(slice.src))).toBe(true);
    expect(
      COLOR_RANGE_SLICES.every((slice) => slice.src.includes("/inventory-source/"))
    ).toBe(true);
    expect(
      COLOR_RANGE_SLICES.every((slice) => !slice.src.includes("/color-collage/"))
    ).toBe(true);

    act(() =>
      root.render(
        <div className="relative h-64">
          <ColorCollageBackground />
        </div>
      )
    );

    const slices = container.querySelector<HTMLElement>(
      '[data-testid="jw-color-collage-slices"]'
    );
    const sliceElements = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid^="jw-color-collage-slice-"]')
    );
    const images = Array.from(
      container.querySelectorAll<HTMLImageElement>('[data-testid="jw-color-collage"] img')
    );

    expect(slices?.style.display).toBe("flex");
    expect(["0", "0px"]).toContain(slices?.style.gap);
    expect(["0", "0px"]).toContain(slices?.style.columnGap);
    expect(["0", "0px"]).toContain(slices?.style.rowGap);
    expect(sliceElements).toHaveLength(8);

    for (const [index, slice] of sliceElements.entries()) {
      expect(slice.style.flex).toBe("0 0 12.5%");
      expect(slice.style.width).toBe("12.5%");
      expect(slice.style.maxWidth).toBe("12.5%");
      expect(["0", "0px"]).toContain(slice.style.margin);
      expect(["0", "0px"]).toContain(slice.style.padding);
      expect(["0", "0px"]).toContain(slice.style.borderWidth || slice.style.border);
      expect(slice.dataset.stoneId).toBe(COLOR_RANGE_SLICES[index]?.stoneId);
      expect(slice.dataset.colorFamily).toBe(COLOR_RANGE_SLICES[index]?.colorFamily);
    }

    expect(images).toHaveLength(8);
    expect(images.every((image) => image.style.display === "block")).toBe(true);
    expect(images.every((image) => image.style.left === "-1px")).toBe(true);
    expect(images.every((image) => image.style.width === "calc(100% + 2px)")).toBe(true);
    expect(images.every((image) => image.src.includes("single-stone-spectrum-1"))).toBe(true);
    expect(images.every((image) => image.src.includes("/inventory-source/"))).toBe(true);
    expect(images.every((image) => !image.src.includes("/color-collage/"))).toBe(true);
  });

  it("tries another photo of the same stone and never leaves a broken-image icon", () => {
    act(() =>
      root.render(
        <div className="relative h-64">
          <ColorCollageBackground />
        </div>
      )
    );

    const fallbackIndex = COLOR_RANGE_SLICES.findIndex((slice) => Boolean(slice.fallbackSrc));
    expect(fallbackIndex).toBeGreaterThanOrEqual(0);

    const image = container.querySelector<HTMLImageElement>(
      `[data-testid="jw-color-collage-slice-${fallbackIndex}"] img`
    );
    const fallbackSrc = COLOR_RANGE_SLICES[fallbackIndex]?.fallbackSrc;
    expect(image).not.toBeNull();
    expect(fallbackSrc).toBeTruthy();

    act(() => {
      image?.dispatchEvent(new Event("error", { bubbles: true }));
    });

    expect(image?.dataset.fallbackApplied).toBe("true");
    expect(image?.src).toContain(fallbackSrc!);
    expect(image?.src).toContain("single-stone-spectrum-1-fallback");

    act(() => {
      image?.dispatchEvent(new Event("error", { bubbles: true }));
    });
    expect(image?.style.visibility).toBe("hidden");
  });
});
