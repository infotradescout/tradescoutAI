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
});
