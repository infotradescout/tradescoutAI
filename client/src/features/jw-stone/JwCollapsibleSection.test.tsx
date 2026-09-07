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

function visibleOpenCloseLabels(root: ParentNode) {
  return Array.from(root.querySelectorAll('[data-testid$="-expand-cue"]')).map(
    (el) => el.textContent?.trim() || ""
  );
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

  it("shows exactly one compact Open/Close cue — never duplicate hint copy", () => {
    act(() => {
      root.render(
        <JwCollapsibleSection
          id="material-library"
          testId="jw-inventory"
          headingId="jw-inventory-heading"
          title="Material Library"
          summary="Must not appear on photo band"
          background={<div data-testid="jw-inventory-collage" />}
        >
          <p data-testid="jw-inventory-body">stone grid</p>
        </JwCollapsibleSection>
      );
    });

    const toggle = container.querySelector('[data-testid="jw-inventory-toggle"]');
    expect(toggle?.tagName).toBe("BUTTON");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("aria-label")).toBe("Open Material Library");
    expect(toggle?.className).toMatch(/cursor-pointer/);
    expect(toggle?.className).toMatch(/focus-visible:ring/);

    expect(container.querySelectorAll('[data-testid="jw-inventory-expand-cue"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="jw-inventory-expand-hint"]')).toBeNull();
    expect(visibleOpenCloseLabels(container)).toEqual(["Open"]);
    expect(container.textContent).not.toMatch(/Tap to open/i);
    expect(container.textContent).not.toMatch(/Tap to close/i);
    expect(container.textContent).not.toContain("Must not appear on photo band");

    const chevron = container.querySelector('[data-testid="jw-inventory-expand-chevron"]');
    expect(chevron).not.toBeNull();
    expect(chevron?.getAttribute("class")).toMatch(/h-6/);
    expect(chevron?.getAttribute("class")).toMatch(/sm:h-7/);

    const cue = container.querySelector('[data-testid="jw-inventory-expand-cue"]');
    expect(cue?.className).not.toMatch(/bg-\[var\(--jw-accent\)\]/);
    expect(cue?.className).not.toMatch(/uppercase/);

    click(toggle);
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(toggle?.getAttribute("aria-label")).toBe("Close Material Library");
    expect(visibleOpenCloseLabels(container)).toEqual(["Close"]);
    expect(
      container.querySelector('[data-testid="jw-inventory-expand-chevron"]')?.getAttribute("class")
    ).toMatch(/rotate-180/);
  });

  it("uses compact collapsed bands and preserves sticky expanded collapse", () => {
    act(() => {
      root.render(
        <JwCollapsibleSection
          id="material-library"
          testId="jw-inventory"
          headingId="jw-inventory-heading"
          title="Material Library"
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
    expect(toggle?.className).toMatch(/min-h-\[8\.5rem\]/);
    expect(toggle?.className).toMatch(/sm:min-h-\[8rem\]/);
    expect(toggle?.className).toMatch(/lg:min-h-\[7\.5rem\]/);
    expect(toggle?.className).not.toMatch(/25svh/);
    expect(toggle?.className).not.toMatch(/\bsticky\b/);

    click(toggle);
    expect(section?.getAttribute("data-expanded")).toBe("true");
    expect(container.querySelector('[data-testid="jw-inventory-body"]')).not.toBeNull();
    expect(toggle?.className).toMatch(/\bsticky\b/);
    expect(toggle?.className).toMatch(/top-14/);
    expect(toggle?.className).not.toMatch(/min-h-\[8\.5rem\]/);
    expect(toggle?.className).not.toMatch(/25svh/);

    click(toggle);
    expect(section?.getAttribute("data-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="jw-inventory-body"]')).toBeNull();
    expect(toggle?.className).toMatch(/min-h-\[8\.5rem\]/);
    expect(toggle?.className).not.toMatch(/\bsticky\b/);
  });

  it("does not force-open when defaultExpanded flips to true after mount", () => {
    act(() => {
      root.render(
        <JwCollapsibleSection
          id="jw-palette-rail"
          testId="jw-palette-rail"
          headingId="jw-palette-heading"
          title="Browse by color"
          defaultExpanded={false}
          backgroundSrc="/images/businesses/jw-stone/story/living-room.webp"
        >
          <p data-testid="jw-palette-body">swatches</p>
        </JwCollapsibleSection>
      );
    });

    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");

    act(() => {
      root.render(
        <JwCollapsibleSection
          id="jw-palette-rail"
          testId="jw-palette-rail"
          headingId="jw-palette-heading"
          title="Browse by color"
          defaultExpanded={true}
          backgroundSrc="/images/businesses/jw-stone/story/living-room.webp"
        >
          <p data-testid="jw-palette-body">swatches</p>
        </JwCollapsibleSection>
      );
    });

    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-palette-body"]')).toBeNull();
  });

  it("keeps header toggle collapse for color/material style sections with one Open cue", () => {
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
    expect(toggle?.getAttribute("aria-label")).toBe("Open Browse by color");
    expect(toggle?.className).toMatch(/min-h-\[8\.5rem\]/);
    expect(visibleOpenCloseLabels(container)).toEqual(["Open"]);

    click(toggle);
    expect(section?.getAttribute("data-expanded")).toBe("true");
    expect(container.querySelector('[data-testid="jw-palette-body"]')).not.toBeNull();
    expect(toggle?.className).toMatch(/\bsticky\b/);
    expect(toggle?.getAttribute("aria-label")).toBe("Close Browse by color");
    expect(visibleOpenCloseLabels(container)).toEqual(["Close"]);

    click(toggle);
    expect(section?.getAttribute("data-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="jw-palette-body"]')).toBeNull();
  });
});
