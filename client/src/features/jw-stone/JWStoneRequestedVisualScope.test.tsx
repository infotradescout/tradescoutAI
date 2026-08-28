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

  it("keeps the approved hero headline visible and removes only the supporting subtext", () => {
    act(() => root.render(<MarketplaceIntroduction />));

    const title = container.querySelector<HTMLElement>("#jw-marketplace-title");
    const subtext = container.querySelector<HTMLElement>(
      '[data-testid="jw-marketplace-local-description"]'
    );

    expect(title?.textContent).toContain("Natural stone, selected at the source.");
    expect(title?.className).not.toContain("sr-only");
    expect(subtext?.hidden).toBe(true);
    expect(subtext?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps Browse by color as one row of eight equal vertical slices", () => {
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
    const images = Array.from(
      container.querySelectorAll<HTMLImageElement>('[data-testid="jw-color-collage"] img')
    );

    expect(slices?.style.gridTemplateColumns).toBe("repeat(8, minmax(0, 1fr))");
    expect(slices?.children).toHaveLength(8);
    expect(slices?.className).not.toMatch(/grid-cols-2|grid-cols-4|grid-rows-/);
    expect(images).toHaveLength(8);
    expect(images.every((image) => image.src.includes("delivery=full-1"))).toBe(true);
  });
});
