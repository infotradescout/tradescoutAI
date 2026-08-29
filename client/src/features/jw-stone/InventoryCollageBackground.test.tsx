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

  it("uses the same yard photo with a 90-degree landscape rotation", () => {
    act(() =>
      root.render(
        <div className="relative h-64 w-[900px]">
          <InventoryCollageBackground />
        </div>
      )
    );

    const background = container.querySelector<HTMLElement>(
      '[data-testid="jw-inventory-collage"]'
    );
    const rotatedFrame = container.querySelector<HTMLElement>(
      '[data-testid="jw-inventory-collage-rotated-frame"]'
    );
    const image = container.querySelector<HTMLImageElement>(
      '[data-testid="jw-inventory-collage-image"]'
    );

    expect(background?.dataset.imageTreatment).toBe("rotated-slab-yard");
    expect(background?.className).toContain("[container-type:size]");
    expect(rotatedFrame?.dataset.rotation).toBe("90");
    expect(rotatedFrame?.dataset.cropFocus).toBe("slab-rows");
    expect(rotatedFrame?.className).toContain("rotate-90");
    expect(rotatedFrame?.className).toContain("h-[100cqw]");
    expect(rotatedFrame?.className).toContain("w-[100cqh]");
    expect(image?.getAttribute("src")).toBe(INVENTORY_SECTION_BACKGROUND.src);
  });

  it("crops toward the slab rows instead of the old bottom-only center slice", () => {
    act(() =>
      root.render(
        <div className="relative h-64 w-[900px]">
          <InventoryCollageBackground />
        </div>
      )
    );

    const images = container.querySelectorAll<HTMLImageElement>(
      '[data-testid="jw-inventory-collage"] img'
    );
    const image = images[0];

    expect(images).toHaveLength(1);
    expect(image?.className).toContain("object-cover");
    expect(image?.className).toContain("object-[50%_72%]");
    expect(image?.className).not.toContain("object-bottom");
    expect(image?.className).not.toContain("rotate-90");
  });
});
