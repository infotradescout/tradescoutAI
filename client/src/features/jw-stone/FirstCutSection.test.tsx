// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirstCutSection } from "./FirstCutSection";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function click(element: Element | null) {
  if (!element) throw new Error("Expected clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

describe("JW Stone First Cut carousel", () => {
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

  function render(onOpen = vi.fn()) {
    act(() => root.render(<FirstCutSection onOpen={onOpen} />));
    return onOpen;
  }

  it("renders the three First Cuts in one compact horizontal carousel", () => {
    render();

    const section = container.querySelector('[data-testid="jw-first-cut"]');
    const rail = container.querySelector('[data-testid="jw-first-cut-rail"]');
    const items = rail?.querySelectorAll(':scope > [data-momentum-item="true"]') ?? [];

    expect(section?.className).toContain("pb-5");
    expect(section?.className).toContain("pt-3");
    expect(rail?.getAttribute("aria-roledescription")).toBe("carousel");
    expect(rail?.className).toContain("flex");
    expect(rail?.className).toContain("overflow-x-auto");
    expect(rail?.className).toContain("[scrollbar-width:none]");
    expect(items).toHaveLength(3);

    expect(container.querySelector(".jw-first-cut__premiere")).toBeNull();
    expect(container.querySelector(".jw-first-cut__lead")).toBeNull();
    expect(container.querySelector(".jw-first-cut__support")).toBeNull();
  });

  it("keeps every carousel card compact while showing the next card", () => {
    render();

    const cards = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[data-testid="jw-first-cut-rail"] > [data-momentum-item="true"]'
      )
    );

    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.className).toContain("h-[10.5rem]");
      expect(card.className).toContain("lg:h-[12.5rem]");
      expect(card.className).toContain("min-w-[84%]");
      expect(card.className).toContain("md:min-w-[48%]");
      expect(card.className).toContain("xl:min-w-[38%]");
      expect(card.className).toContain("shrink-0");
    }

    const leadFrame = container.querySelector<HTMLElement>(
      '[data-first-cut-lead="true"] > span'
    );
    expect(leadFrame?.className).toContain("aspect-[12/5]");
  });

  it("provides visible previous and next controls without removing native swipe", () => {
    render();

    const previous = container.querySelector<HTMLButtonElement>(
      '[data-testid="jw-first-cut-previous"]'
    );
    const next = container.querySelector<HTMLButtonElement>('[data-testid="jw-first-cut-next"]');
    const rail = container.querySelector<HTMLElement>('[data-testid="jw-first-cut-rail"]');

    expect(previous).not.toBeNull();
    expect(next).not.toBeNull();
    expect(previous?.disabled).toBe(true);
    expect(next?.disabled).toBe(false);
    expect(rail?.className).toContain("overscroll-x-contain");

    click(next);
    expect(previous?.disabled).toBe(false);
  });

  it("still opens the selected First Cut in the full slab viewer", () => {
    const onOpen = render();
    const firstCut = container.querySelector('[data-first-cut-lead="true"]');

    click(firstCut);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "first-cut-1",
        publicLabel: "First Cut",
        anonymous: true,
        wishlistEligible: false,
        images: ["/images/businesses/jw-stone/first-cut/05.jpg"],
      })
    );
  });
});
