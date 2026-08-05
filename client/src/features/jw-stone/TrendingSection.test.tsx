// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import { selectTrendingItems } from "./trending";
import { TrendingSection } from "./TrendingSection";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("TrendingSection", () => {
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

  it("keeps compact stone palette + Pairs with on each trending card", () => {
    const items = selectTrendingItems(JW_STONE_CATALOG, { limit: 3 }).filter(
      (stone) => stone.colorSwatches.length > 0
    );
    expect(items.length).toBeGreaterThan(0);

    act(() => root.render(<TrendingSection items={items} onOpen={vi.fn()} onAsk={vi.fn()} />));

    const cards = container.querySelectorAll<HTMLElement>("[data-trending='true']");
    expect(cards.length).toBe(items.length);
    for (const card of cards) {
      expect(card.textContent).toContain("Pairs with");
      expect(card.querySelector('[aria-label^="Colors #"]')).not.toBeNull();
      expect(card.querySelector('[aria-label^="Pairs with #"]')).not.toBeNull();
      expect(card.querySelector("img")?.className).toMatch(/object-contain/);
    }
  });
});
