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

  it("shows the confirmed country on the Honey Onyx card", () => {
    const stone = JW_STONE_CATALOG.find((entry) => entry.id === "honey-onyx")!;
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
    expect(container.textContent).toContain("Country of origin: Iran");
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
    expect(card?.querySelector('button[aria-label^="Save "]')?.className).toMatch(/rounded-full/);
    expect(card?.textContent).toContain("View stone");
    expect(card?.textContent).toContain("Ask");
    expect(card?.textContent).not.toContain("Pairs with");
    expect(card?.textContent).not.toContain("Colors from photo");
    expect(image?.className).toMatch(/h-full/);
    expect(image?.className).toMatch(/w-full/);
    expect(image?.className).toMatch(/object-contain/);
    expect(image?.className).not.toMatch(/h-auto|object-cover/);

    const ask = Array.from(card?.querySelectorAll("button") || []).find((button) =>
      (button.textContent || "").includes("Ask")
    );
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
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-dots"]')).not.toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-prev"]')).not.toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-next"]')).not.toBeNull();
    expect(
      card?.querySelector('[data-testid="jw-stone-card-photo-dot-0"]')?.getAttribute("aria-current")
    ).toBe("true");

    const stableMediaClass = media?.className;
    click(card?.querySelector('[data-testid="jw-stone-card-photo-next"]') ?? null);
    expect(
      card?.querySelector('[data-testid="jw-stone-card-photo-dot-1"]')?.getAttribute("aria-current")
    ).toBe("true");
    expect(media?.className).toBe(stableMediaClass);

    click(card?.querySelector('[data-testid="jw-stone-card-photo-dot-0"]') ?? null);
    expect(
      card?.querySelector('[data-testid="jw-stone-card-photo-dot-0"]')?.getAttribute("aria-current")
    ).toBe("true");

    if (!rail) throw new Error("Expected native photo rail");
    setRailGeometry(rail, slides);
    rail.scrollLeft = 100;
    act(() => rail.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(
      card?.querySelector('[data-testid="jw-stone-card-photo-dot-1"]')?.getAttribute("aria-current")
    ).toBe("true");
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
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-dots"]')).toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-prev"]')).toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-next"]')).toBeNull();
  });
});
