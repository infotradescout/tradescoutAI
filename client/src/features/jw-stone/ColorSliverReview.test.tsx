// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ColorSliverReview from "./ColorSliverReview";
import { getColorSliverSrc } from "./stoneColors";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("ColorSliverReview", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders a scrollable grid of stone slivers for owner review", () => {
    act(() => {
      root.render(<ColorSliverReview />);
    });

    expect(container.querySelector('[data-testid="jw-color-sliver-review"]')).not.toBeNull();
    expect(container.textContent).toMatch(/Color sliver review/i);
    expect(container.querySelector('[data-testid="jw-sliver-search"]')).not.toBeNull();

    const alabama = container.querySelector('[data-testid="jw-sliver-card-alabama-white"]');
    expect(alabama).not.toBeNull();
    expect(alabama?.textContent).toMatch(/Alabama White/i);
    expect(alabama?.textContent?.toLowerCase()).toContain("white");

    const img = alabama?.querySelector("img");
    const expected = getColorSliverSrc("alabama-white");
    expect(expected).toBeTruthy();
    expect(img?.getAttribute("src")).toContain(expected!);
    expect(img?.getAttribute("src")).toContain("v=sliver-1");
  });

  it("includes Black Pearl so dark-face crops are inspectable", () => {
    act(() => {
      root.render(<ColorSliverReview />);
    });
    const card = container.querySelector('[data-testid="jw-sliver-card-black-pearl"]');
    expect(card?.querySelector("img")?.getAttribute("src")).toContain("black-pearl.webp");
  });
});
