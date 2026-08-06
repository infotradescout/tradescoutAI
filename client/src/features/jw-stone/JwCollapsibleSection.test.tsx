// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JwCollapsibleSection } from "./JwCollapsibleSection";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function click(el: Element | null) {
  if (!el) throw new Error("Expected clickable element");
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("JwCollapsibleSection", () => {
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

  it("expands and collapses Full inventory via the photo header toggle", () => {
    act(() => {
      root.render(
        <JwCollapsibleSection
          id="current-inventory"
          testId="jw-inventory"
          headingId="jw-inventory-heading"
          title="Full inventory"
          background={<div data-testid="jw-inventory-collage" />}
        >
          <p data-testid="jw-inventory-body">stone grid</p>
        </JwCollapsibleSection>
      );
    });

    const section = container.querySelector('[data-testid="jw-inventory"]');
    const toggle = container.querySelector('[data-testid="jw-inventory-toggle"]');
    expect(section?.getAttribute("data-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="jw-inventory-body"]')).toBeNull();
    expect(toggle?.className).toMatch(/min-h-\[25svh\]/);
    expect(toggle?.className).not.toMatch(/\bsticky\b/);

    click(toggle);
    expect(section?.getAttribute("data-expanded")).toBe("true");
    expect(container.querySelector('[data-testid="jw-inventory-body"]')).not.toBeNull();
    // Expanded: compact sticky band stays reachable while scrolling inventory.
    expect(toggle?.className).toMatch(/\bsticky\b/);
    expect(toggle?.className).toMatch(/top-14/);
    expect(toggle?.className).not.toMatch(/min-h-\[25svh\]/);
    expect(container.querySelector('[data-testid="jw-inventory-collapse"]')).toBeNull();
    expect(container.textContent).not.toMatch(/Close Full inventory/i);

    click(toggle);
    expect(section?.getAttribute("data-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="jw-inventory-body"]')).toBeNull();
    expect(toggle?.className).toMatch(/min-h-\[25svh\]/);
    expect(toggle?.className).not.toMatch(/\bsticky\b/);
  });

  it("keeps header toggle collapse for color/material style sections", () => {
    act(() => {
      root.render(
        <JwCollapsibleSection
          id="jw-palette-rail"
          testId="jw-palette-rail"
          headingId="jw-palette-heading"
          title="Browse by color"
          backgroundSrc="/images/businesses/jw-stone/story/living-room.webp"
        >
          <p data-testid="jw-palette-body">swatches</p>
        </JwCollapsibleSection>
      );
    });

    const section = container.querySelector('[data-testid="jw-palette-rail"]');
    const toggle = container.querySelector('[data-testid="jw-palette-rail-toggle"]');
    expect(section?.getAttribute("data-expanded")).toBe("false");

    click(toggle);
    expect(section?.getAttribute("data-expanded")).toBe("true");
    expect(container.querySelector('[data-testid="jw-palette-body"]')).not.toBeNull();
    expect(toggle?.className).toMatch(/\bsticky\b/);
    expect(container.textContent).not.toMatch(/Close Browse by color/i);

    click(toggle);
    expect(section?.getAttribute("data-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="jw-palette-body"]')).toBeNull();
  });
});
