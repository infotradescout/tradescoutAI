// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import { StoneCard } from "./StoneCard";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

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

  it("shows Save, View stone, and Ask without color swatches or Pairs with", () => {
    const stone =
      JW_STONE_CATALOG.find((entry) => entry.id === "blue-dunes") ||
      JW_STONE_CATALOG.find((entry) => entry.wishlistEligible);
    expect(stone).toBeTruthy();
    if (!stone) throw new Error("Expected a named wishlist-eligible stone");

    const onAsk = vi.fn();
    const onToggleSaved = vi.fn();
    const onOpen = vi.fn();

    act(() =>
      root.render(
        <StoneCard
          stone={stone}
          saved={false}
          onToggleSaved={onToggleSaved}
          onOpen={onOpen}
          onAsk={onAsk}
        />
      )
    );

    const card = container.querySelector<HTMLElement>("[data-stone-card]");
    expect(card).not.toBeNull();
    expect(card?.querySelector('button[aria-label^="Save "]')).not.toBeNull();
    expect(card?.textContent).toContain("View stone");
    expect(card?.textContent).toContain("Ask");
    expect(card?.textContent).not.toContain("Pairs with");
    expect(card?.textContent).not.toContain("Colors from photo");
    expect(card?.querySelector('[aria-label^="Colors #"]')).toBeNull();
    expect(card?.querySelector('[aria-label^="Pairs with #"]')).toBeNull();
    expect(card?.querySelector("img")?.className).toMatch(/h-auto/);
    expect(card?.querySelector("img")?.className).toMatch(/object-contain/);
    expect(card?.querySelector("img")?.className).not.toMatch(/object-cover|aspect-/);

    const ask = Array.from(card?.querySelectorAll("button") || []).find((button) =>
      (button.textContent || "").includes("Ask")
    );
    expect(ask).toBeTruthy();
    act(() => ask?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onAsk).toHaveBeenCalledWith(stone);
  });

  it("lets shoppers browse multiple mapped photos on the card", () => {
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
    expect(card?.getAttribute("data-photo-count")).toBe(String(stone.images.length));
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-dots"]')).not.toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-prev"]')).not.toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-next"]')).not.toBeNull();
    expect(card?.querySelector("img")?.getAttribute("src")).toBe(stone.images[0]);

    act(() =>
      card
        ?.querySelector('[data-testid="jw-stone-card-photo-next"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(card?.querySelector("img")?.getAttribute("src")).toBe(stone.images[1]);

    act(() =>
      card
        ?.querySelector('[data-testid="jw-stone-card-photo-dot-0"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    );
    expect(card?.querySelector("img")?.getAttribute("src")).toBe(stone.images[0]);
  });

  it("defers edge arrows to mediaChrome on material pager but keeps photo dots", () => {
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
          mediaChrome={<button type="button">Stone pager chrome</button>}
        />
      )
    );

    const card = container.querySelector<HTMLElement>("[data-stone-card]");
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-dots"]')).not.toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-prev"]')).toBeNull();
    expect(card?.querySelector('[data-testid="jw-stone-card-photo-next"]')).toBeNull();
    expect(card?.textContent).toContain("Stone pager chrome");
  });
});
