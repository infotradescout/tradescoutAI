// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import { StoneCard } from "./StoneCard";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function setRailGeometry(rail: HTMLElement, slides: HTMLElement[], width = 100) {
  Object.defineProperty(rail, "clientWidth", { configurable: true, value: width });
  slides.forEach((slide, index) => {
    Object.defineProperty(slide, "offsetLeft", {
      configurable: true,
      value: index * width,
    });
    Object.defineProperty(slide, "offsetWidth", { configurable: true, value: width });
  });
}

describe("StoneCard", () => {
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

  it("keeps stone photography in a fixed presentation frame with premium card controls", () => {
    const stone =
      JW_STONE_CATALOG.find((entry) => entry.id === "blue-dunes") ||
      JW_STONE_CATALOG.find((entry) => entry.wishlistEligible);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a named wishlist-eligible stone");

    const onAsk = vi.fn();

    act(() =>
      root.render(
        <StoneCard
          stone={stone}
          saved={false}
          onToggleSaved={vi.fn()}
          onOpen={vi.fn()}
          onAsk={onAsk}
        />
      )
    );

    const card = container.querySelector<HTMLElement>("[data-stone-card]");
    const media = card?.querySelector<HTMLElement>('[data-testid="jw-stone-card-media"]');
    const image = card?.querySelector<HTMLImageElement>("img");
    expect(card).not.toBeNull();
    expect(media?.className).toMatch(/aspect-\[4\/3\]/);
    expect(media?.className).toMatch(/overflow-hidden/);
    const save = card?.querySelector<HTMLButtonElement>('button[aria-label^="Save "]');
    expect(save?.className).toMatch(/rounded-full/);
    expect(save?.className).toMatch(/\bh-11\b/);
    expect(save?.className).toMatch(/\bw-11\b/);
    expect(card?.textContent).toContain("View stone");
    expect(card?.textContent).toContain("Ask");
    expect(card?.textContent).not.toContain("Pairs with");
    expect(card?.textContent).not.toContain("Colors from photo");
    expect(image?.className).toMatch(/h-full/);
    expect(image?.className).toMatch(/w-full/);
    expect(image?.className).toMatch(/object-cover/);
    expect(image?.className).toMatch(/object-center/);
    expect(image?.className).not.toMatch(/h-auto|object-contain/);
    expect(media?.querySelector(".blur-2xl")).toBeNull();

    const ask = Array.from(card?.querySelectorAll("button") || []).find((button) =>
      (button.textContent || "").includes("Ask")
    );
    const view = Array.from(card?.querySelectorAll("button") || []).find((button) =>
      (button.textContent || "").includes("View stone")
    );
    expect(view?.className).toMatch(/min-h-11/);
    expect(ask?.className).toMatch(/min-h-11/);
    click(ask ?? null);
    expect(onAsk).toHaveBeenCalledWith(stone);
  });

  it("uses a free native momentum rail and tracks the nearest photo without hard snap", () => {
    const stone = JW_STONE_CATALOG.find(
      (entry) => entry.images.length > 1 && entry.wishlistEligible
    );
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a multi-image wishlist stone");

    act(() =>
      root.render(
        <StoneCard
          stone={stone}
          saved={false}
          onToggleSaved={vi.fn()}
          onOpen={vi.fn()}
          onAsk={vi.fn()}
        />
      )
    );

    const card = container.querySelector<HTMLElement>("[data-stone-card]");
    const media = card?.querySelector<HTMLElement>('[data-testid="jw-stone-card-media"]');
    const rail = card?.querySelector<HTMLElement>('[data-testid="jw-stone-card-photo-rail"]');
    const slides = Array.from(
      rail?.querySelectorAll<HTMLElement>('[data-momentum-item="true"]') || []
    );
    expect(card?.getAttribute("data-photo-count")).toBe(String(stone.images.length));
    expect(rail?.className).toMatch(/overflow-x-auto/);
    expect(rail?.className).toMatch(/overscroll-x-contain/);
    expect(rail?.className).toContain("[-webkit-overflow-scrolling:touch]");
    expect(rail?.className).not.toMatch(/snap-/);
    expect(slides).toHaveLength(stone.images.length);
    expect(media?.className).toMatch(/aspect-\[4\/3\]/);
    const indicator = card?.querySelector<HTMLElement>(
      '[data-testid="jw-stone-card-photo-indicator"]'
    );
    expect(indicator?.textContent).toContain(`1 / ${stone.images.length}`);
    expect(indicator?.getAttribute("aria-label")).toBe(`Photo 1 of ${stone.images.length}`);
    expect(card?.querySelectorAll('[data-testid^="jw-stone-card-photo-dot-"]')).toHaveLength(0);
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-prev"]')).not.toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-next"]')).not.toBeNull();

    const stableMediaClass = media?.className;
    click(card?.querySelector('[data-testid="jw-stone-card-photo-next"]') ?? null);
    expect(indicator?.textContent).toContain(`2 / ${stone.images.length}`);
    expect(indicator?.getAttribute("aria-label")).toBe(`Photo 2 of ${stone.images.length}`);
    expect(media?.className).toBe(stableMediaClass);

    click(card?.querySelector('[data-testid="jw-stone-card-photo-prev"]') ?? null);
    expect(indicator?.textContent).toContain(`1 / ${stone.images.length}`);

    if (!rail) throw new Error("Expected native photo rail");
    setRailGeometry(rail, slides);
    rail.scrollLeft = 100;
    act(() => rail.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(indicator?.textContent).toContain(`2 / ${stone.images.length}`);
  });

  it("renders a real single-photo stone without gallery chrome or 1 of 1 labels", () => {
    const stone = JW_STONE_CATALOG.find((entry) => entry.images.length === 1);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a single-image stone");
    const onOpen = vi.fn();

    act(() =>
      root.render(
        <StoneCard
          stone={stone}
          saved={false}
          onToggleSaved={vi.fn()}
          onOpen={onOpen}
          onAsk={vi.fn()}
        />
      )
    );

    const card = container.querySelector<HTMLElement>("[data-stone-card]");
    const rail = card?.querySelector<HTMLElement>('[data-testid="jw-stone-card-photo-rail"]');
    const photo = card?.querySelector<HTMLButtonElement>('[data-testid="jw-stone-card-photo-0"]');
    const image = photo?.querySelector("img");
    expect(card?.getAttribute("data-photo-count")).toBe("1");
    expect(rail?.querySelectorAll('[data-momentum-item="true"]')).toHaveLength(1);
    expect(rail?.getAttribute("role")).toBeNull();
    expect(rail?.getAttribute("aria-roledescription")).toBeNull();
    expect(photo?.getAttribute("aria-label")).toBe(`Open ${stone.publicLabel}`);
    expect(image?.getAttribute("alt")).not.toMatch(/view 1|1 of 1/i);
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-indicator"]')).toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-prev"]')).toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-next"]')).toBeNull();
    const accessibleLabels = Array.from(
      card?.querySelectorAll<HTMLElement>("[aria-label]") || []
    ).map((element) => element.getAttribute("aria-label") || "");
    expect(accessibleLabels.some((label) => /1 of 1/i.test(label))).toBe(false);

    click(photo ?? null);
    expect(onOpen).toHaveBeenCalledWith(stone);
  });

  it("uses a single static cover when nested inside the material momentum rail", () => {
    const stone = JW_STONE_CATALOG.find((entry) => entry.images.length > 1);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a multi-image stone");

    act(() =>
      root.render(
        <StoneCard
          stone={stone}
          saved={false}
          onToggleSaved={vi.fn()}
          onOpen={vi.fn()}
          onAsk={vi.fn()}
          photoBrowsing={false}
        />
      )
    );

    const card = container.querySelector<HTMLElement>("[data-stone-card]");
    expect(card?.getAttribute("data-photo-count")).toBe(String(stone.images.length));
    expect(card?.querySelectorAll('[data-momentum-item="true"]')).toHaveLength(1);
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-indicator"]')).toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-prev"]')).toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-next"]')).toBeNull();
  });
});
