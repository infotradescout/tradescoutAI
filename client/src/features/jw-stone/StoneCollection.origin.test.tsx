// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { JW_STONE_NAMED_CATALOG } from "./catalog";
import { StoneCollection } from "./StoneCollection";
import { confirmedSlabCount } from "./stoneFacts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("JW Stone verified-origin collection path", () => {
  it("keeps filter controls in the Filter sheet (no permanent filter boxes)", () => {
    const sourceStone = JW_STONE_NAMED_CATALOG.find((stone) => confirmedSlabCount(stone) === null)!;
    if (!sourceStone.materialId) throw new Error("Expected fixture materialId");
    const fixtureStone = {
      ...sourceStone,
      origin: {
        country: "Brazil",
        verified: true as const,
        source: "test-only JW source fixture",
      },
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <StoneCollection
          state={{
            aesthetic: null,
            color: null,
            material: null,
            origin: null,
            stone: null,
          }}
          catalog={[fixtureStone]}
          isSaved={() => false}
          onUpdateFilters={vi.fn()}
          onToggleSaved={vi.fn()}
          onOpen={vi.fn()}
          onAsk={vi.fn()}
        />
      );
    });

    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(0);

    const inventoryToggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="jw-inventory-toggle"]'
    );

    act(() => {
      inventoryToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("true");
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(1);
    expect(inventoryToggle?.className).toMatch(/\bsticky\b/);
    expect(container.querySelector('select[aria-label="Color"]')).toBeNull();
    expect(container.querySelector('select[aria-label="Material"]')).toBeNull();
    expect(container.querySelector('select[aria-label="Finish"]')).toBeNull();
    expect(container.querySelector('select[aria-label="Availability"]')).toBeNull();

    act(() => {
      inventoryToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(0);

    act(() => {
      inventoryToggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="jw-filters-sheet-open"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="jw-filters-sheet"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Color"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Material"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Finish"]')).not.toBeNull();
    const availability = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Availability"]'
    );
    expect(availability).not.toBeNull();
    expect(Array.from(availability!.options, (option) => option.textContent)).toEqual([
      "Availability",
      "Slab count known",
    ]);
    act(() => {
      availability!.value = "with-count";
      availability!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // Refinements stay in the sheet until applied; verified origin alone does not prove a count.
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(1);
    const apply = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Show 0 results"
    );
    expect(apply).toBeDefined();
    act(() => apply!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector('[data-testid="jw-filters-sheet"]')).toBeNull();
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(0);
    const clear = container.querySelector<HTMLButtonElement>(
      '[aria-label="Active filters"] button'
    );
    expect(clear?.textContent).toContain("Slab count known");
    act(() => clear!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(1);

    act(() => root.unmount());
    container.remove();
  });
});
