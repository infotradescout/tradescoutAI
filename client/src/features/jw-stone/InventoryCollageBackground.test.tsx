// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InventoryCollageBackground } from "./InventoryCollageBackground";
import { INVENTORY_SECTION_BACKGROUND } from "./storyBackgrounds";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("JW Stone Browse Full Inventory image treatment", () => {
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

  function renderBackground() {
    act(() =>
      root.render(
        <div className="relative h-64 w-[1200px]">
          <InventoryCollageBackground />
        </div>
      )
    );
  }

  it("keeps the yard image in its native landscape orientation", () => {
    renderBackground();

    const background = container.querySelector<HTMLElement>(
      '[data-testid="jw-inventory-collage"]'
    );
    const image = container.querySelector<HTMLImageElement>(
      '[data-testid="jw-inventory-collage-image"]'
    );

    expect(background?.dataset.imageTreatment).toBe("full-width-slab-panorama");
    expect(background?.className).not.toContain("[container-type:size]");
    expect(image?.getAttribute("src")).toBe(INVENTORY_SECTION_BACKGROUND.src);
    expect(image?.dataset.rotation).toBe("0");
    expect(image?.dataset.cropFocus).toBe("full-slab-row");
    expect(container.querySelector('[data-testid="jw-inventory-collage-rotated-frame"]')).toBeNull();
  });

  it("shows the complete horizontal inventory run instead of a rotated narrow strip", () => {
    renderBackground();

    const images = container.querySelectorAll<HTMLImageElement>(
      '[data-testid="jw-inventory-collage"] img'
    );
    const image = images[0];

    expect(images).toHaveLength(1);
    expect(image?.className).toContain("absolute");
    expect(image?.className).toContain("inset-0");
    expect(image?.className).toContain("h-full");
    expect(image?.className).toContain("w-full");
    expect(image?.className).toContain("object-cover");
    expect(image?.className).toContain("object-[50%_54%]");
    expect(image?.className).not.toContain("rotate-90");
    expect(image?.className).not.toContain("scale-");
    expect(image?.className).not.toContain("h-[100cqw]");
    expect(image?.className).not.toContain("w-[100cqh]");
  });
});
