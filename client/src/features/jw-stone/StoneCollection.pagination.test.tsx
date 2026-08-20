// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_NAMED_CATALOG } from "./catalog";
import { INVENTORY_PAGE_SIZE, StoneCollection } from "./StoneCollection";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const EMPTY_STATE = {
  aesthetic: null,
  color: null,
  material: null,
  origin: null,
  stone: null,
} as const;

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function change(element: HTMLSelectElement | null, value: string) {
  if (!element) throw new Error("Expected an inventory page selector");
  act(() => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function cardIds(container: ParentNode): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-stone-card]"), (card) => {
    const id = card.dataset.stoneId;
    if (!id) throw new Error("Expected every rendered inventory card to expose its stone id");
    return id;
  });
}

describe("JW Stone full-inventory pagination", () => {
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

  it("mounts one bounded page while keeping every current named stone reachable", () => {
    act(() => {
      root.render(
        <StoneCollection
          state={EMPTY_STATE}
          catalog={JW_STONE_NAMED_CATALOG}
          isSaved={() => false}
          onUpdateFilters={vi.fn()}
          onToggleSaved={vi.fn()}
          onOpen={vi.fn()}
          onAsk={vi.fn()}
        />
      );
    });

    click(container.querySelector('[data-testid="jw-inventory-toggle"]'));

    const expectedIds = new Set(JW_STONE_NAMED_CATALOG.map((stone) => stone.id));
    const seenIds = new Set<string>();
    const inventoryCount = JW_STONE_NAMED_CATALOG.length;
    const pageCount = Math.ceil(inventoryCount / INVENTORY_PAGE_SIZE);
    const pageSelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Choose inventory page (top)"]'
    );

    expect(pageCount).toBeGreaterThan(1);
    expect(expectedIds.size).toBe(inventoryCount);
    expect(pageSelect?.options).toHaveLength(pageCount);

    let firstPageIds: string[] = [];

    for (let page = 0; page < pageCount; page += 1) {
      const visibleIds = cardIds(container);
      const expectedVisibleCount = Math.min(
        INVENTORY_PAGE_SIZE,
        inventoryCount - page * INVENTORY_PAGE_SIZE
      );

      expect(visibleIds).toHaveLength(expectedVisibleCount);
      expect(visibleIds.length).toBeLessThanOrEqual(INVENTORY_PAGE_SIZE);
      if (page === 0) firstPageIds = visibleIds;
      visibleIds.forEach((id) => seenIds.add(id));
      expect(
        container.querySelector('[data-testid="jw-inventory-page-status-top"]')?.textContent
      ).toBe(`Page ${page + 1} of ${pageCount}`);

      if (page < pageCount - 1) {
        click(
          container.querySelector(
            page === 0
              ? '[data-testid="jw-inventory-page-next-bottom"]'
              : '[data-testid="jw-inventory-page-next-top"]'
          )
        );
        expect(document.activeElement).toBe(
          container.querySelector('[data-testid="jw-inventory-page-status-top"]')
        );
      }
    }

    expect(seenIds).toEqual(expectedIds);
    expect(
      container.querySelector<HTMLButtonElement>(
        '[data-testid="jw-inventory-page-next-top"]'
      )?.disabled
    ).toBe(true);
    change(pageSelect, "0");
    expect(cardIds(container)).toEqual(firstPageIds);
    expect(
      container.querySelector('[data-testid="jw-inventory-page-status-bottom"]')?.textContent
    ).toBe(`Page 1 of ${pageCount}`);
    expect(container.querySelectorAll('[data-testid="jw-stone-card-photo-0"]')).toHaveLength(
      cardIds(container).length
    );
    expect(container.querySelector('[data-testid="jw-stone-card-photo-1"]')).toBeNull();
  });

  it("keeps the selected stone inquiry deliberate after page navigation", () => {
    const onAsk = vi.fn();
    const onOpen = vi.fn();

    act(() => {
      root.render(
        <StoneCollection
          state={EMPTY_STATE}
          catalog={JW_STONE_NAMED_CATALOG}
          isSaved={() => false}
          onUpdateFilters={vi.fn()}
          onToggleSaved={vi.fn()}
          onOpen={onOpen}
          onAsk={onAsk}
        />
      );
    });

    click(container.querySelector('[data-testid="jw-inventory-toggle"]'));
    click(container.querySelector('[data-testid="jw-inventory-page-next-top"]'));

    const selectedCard = container.querySelector<HTMLElement>("[data-stone-card]");
    const selectedId = selectedCard?.dataset.stoneId;
    if (!selectedCard || !selectedId) throw new Error("Expected a stone on inventory page two");

    const ask = Array.from(selectedCard.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Ask"
    );
    click(ask ?? null);

    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(onAsk).toHaveBeenCalledWith(expect.objectContaining({ id: selectedId }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(container.textContent).not.toMatch(/\$\s*\d/);
  });
});
