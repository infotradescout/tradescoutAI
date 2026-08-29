// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ColorCollageBackground } from "./ColorCollageBackground";
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

  it("keeps Browse by color as one continuous row of eight equal slices with no gaps", () => {
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
    expect(["0", "0px"]).toContain(slices?.style.margin);
    expect(["0", "0px"]).toContain(slices?.style.padding);
    expect(sliceElements).toHaveLength(8);

    for (const slice of sliceElements) {
      expect(slice.style.flex).toBe("0 0 12.5%");
      expect(slice.style.width).toBe("12.5%");
      expect(slice.style.maxWidth).toBe("12.5%");
      expect(["0", "0px"]).toContain(slice.style.margin);
      expect(["0", "0px"]).toContain(slice.style.padding);
      expect(["0", "0px"]).toContain(slice.style.borderWidth || slice.style.border);
    }

    expect(images).toHaveLength(8);
    expect(images.every((image) => image.style.display === "block")).toBe(true);
    expect(images.every((image) => image.style.left === "-1px")).toBe(true);
    expect(images.every((image) => image.style.width === "calc(100% + 2px)")).toBe(true);
    expect(images.every((image) => image.src.includes("v=face-truth-1"))).toBe(true);
    expect(images.every((image) => image.src.includes("delivery=full-3"))).toBe(true);
  });

  it("replaces the failed white derivative with a verified full slab photo", () => {
    act(() =>
      root.render(
        <div className="relative h-64">
          <ColorCollageBackground />
        </div>
      )
    );

    const firstImage = container.querySelector<HTMLImageElement>(
      '[data-testid="jw-color-collage"] img'
    );
    expect(firstImage).not.toBeNull();

    act(() => {
      firstImage?.dispatchEvent(new Event("error", { bubbles: true }));
    });

    expect(firstImage?.src).toContain(
      "/images/businesses/jw-stone/inventory-source/1eFzZ0N8SlJaweTLRTthTXfQtUyLinqRT.webp"
    );
    expect(firstImage?.src).toContain("v=white-face-fallback-1");
  });
});
