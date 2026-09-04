// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InventoryCollageBackground } from "./InventoryCollageBackground";
import { INVENTORY_SECTION_BACKGROUND } from "./storyBackgrounds";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("JW Stone Material Library image treatment", () => {
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

  it("shows a smaller, gently rotated inventory panorama", () => {
    renderBackground();

    const background = container.querySelector<HTMLElement>(
      '[data-testid="jw-inventory-collage"]'
    );
    const image = container.querySelector<HTMLImageElement>(
      '[data-testid="jw-inventory-collage-image"]'
    );

    expect(background?.dataset.imageTreatment).toBe("zoomed-out-slab-panorama");
    expect(image?.getAttribute("src")).toBe(INVENTORY_SECTION_BACKGROUND.src);
    expect(image?.dataset.rotation).toBe("1.5");
    expect(image?.dataset.zoom).toBe("0.88-desktop");
    expect(image?.dataset.cropFocus).toBe("full-slab-yard");
    expect(image?.className).toContain("rotate-[1.5deg]");
    expect(image?.className).toContain("h-[92%]");
    expect(image?.className).toContain("sm:w-[96%]");
    expect(image?.className).toContain("lg:w-[88%]");
    expect(image?.className).not.toContain("rotate-90");
    expect(image?.className).not.toContain("w-full");
  });

  it("uses a soft full-bleed copy behind the zoomed-out image instead of empty edges", () => {
    renderBackground();

    const images = container.querySelectorAll<HTMLImageElement>(
      '[data-testid="jw-inventory-collage"] img'
    );
    const fill = container.querySelector<HTMLImageElement>(
      '[data-testid="jw-inventory-collage-fill"]'
    );

    expect(images).toHaveLength(2);
    expect(fill?.getAttribute("src")).toBe(INVENTORY_SECTION_BACKGROUND.src);
    expect(fill?.className).toContain("inset-0");
    expect(fill?.className).toContain("h-full");
    expect(fill?.className).toContain("w-full");
    expect(fill?.className).toContain("object-cover");
    expect(fill?.className).toContain("blur-[4px]");
    expect(fill?.className).toContain("opacity-70");
  });
});
