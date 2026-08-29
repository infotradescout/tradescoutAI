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

  it("uses one neutral and seven clearly different reviewed stone faces", () => {
    expect(COLOR_RANGE_STONE_DEFS.map((slice) => slice.colorFamily)).toEqual([
      "white",
      "rust",
      "amber",
      "gold",
      "green",
      "blue",
      "bronze",
      "black",
    ]);
    expect(COLOR_RANGE_STONE_DEFS.map((slice) => slice.stoneId)).toEqual([
      "rhino-white",
      "dueto",
      "honey-onyx",
      "gold-macaubas",
      "amazonic-green",
      "blue-dream",
      "bronzonite",
      "titanium-black-leathered",
    ]);
    expect(COLOR_RANGE_STONE_DEFS[1]).toMatchObject({
      stoneId: "dueto",
      colorFamily: "rust",
      src: "/images/businesses/jw-stone/color-slivers/dueto.webp",
    });
    expect(COLOR_RANGE_SLICES).toHaveLength(8);
    expect(new Set(COLOR_RANGE_SLICES.map((slice) => slice.stoneId)).size).toBe(8);
    expect(new Set(COLOR_RANGE_SLICES.map((slice) => slice.colorFamily)).size).toBe(8);
    expect(COLOR_RANGE_SLICES.every((slice) => Boolean(slice.src))).toBe(true);
    expect(
      COLOR_RANGE_SLICES.every((slice) => slice.src.includes("/color-slivers/"))
    ).toBe(true);
    expect(
      COLOR_RANGE_SLICES.every((slice) => !slice.src.includes("/inventory-source/"))
    ).toBe(true);
    expect(
      COLOR_RANGE_SLICES.every((slice) => !slice.src.includes("/color-collage/"))
    ).toBe(true);
    expect(
      COLOR_RANGE_SLICES.every(
        (slice) => !slice.fallbackSrc || slice.fallbackSrc.includes("/color-slivers/")
      )
    ).toBe(true);

    const everyConfiguredAsset = COLOR_RANGE_SLICES.flatMap((slice) =>
      slice.fallbackSrc ? [slice.src, slice.fallbackSrc] : [slice.src]
    );
    expect(everyConfiguredAsset.some((src) => src.includes("trending-selection-"))).toBe(false);
    expect(everyConfiguredAsset).not.toContain(
      "/images/businesses/jw-stone/color-slivers/trending-selection-03.webp"
    );

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
      expect(slice.dataset.cropMode).toBe("slab-core-sliver");
    }

    expect(images).toHaveLength(8);
    expect(images.every((image) => image.style.display === "block")).toBe(true);
    expect(images.every((image) => image.style.left === "-1px")).toBe(true);
    expect(images.every((image) => image.style.width === "calc(100% + 2px)")).toBe(true);
    expect(images.every((image) => image.style.objectPosition === "center")).toBe(true);
    expect(images.every((image) => image.src.includes("slab-core-spectrum-3"))).toBe(true);
    expect(images.every((image) => image.src.includes("/color-slivers/"))).toBe(true);
    expect(images.every((image) => !image.src.includes("/inventory-source/"))).toBe(true);
    expect(images.every((image) => !image.src.includes("/color-collage/"))).toBe(true);
    expect(images.every((image) => !image.src.includes("trending-selection-"))).toBe(true);
  });

  it("falls back only to another reviewed slab crop and never leaves a broken-image icon", () => {
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
    expect(image?.src).toContain("slab-core-spectrum-3-fallback");
    expect(image?.src).toContain("/color-slivers/");
    expect(image?.src).not.toContain("/inventory-source/");
    expect(image?.src).not.toContain("trending-selection-");

    act(() => {
      image?.dispatchEvent(new Event("error", { bubbles: true }));
    });
    expect(image?.style.visibility).toBe("hidden");
  });
});
