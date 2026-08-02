// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { JW_STONE_NAMED_CATALOG } from "./catalog";
import { BuyerWorkspace } from "./BuyerWorkspace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("JW Stone verified-origin workspace path", () => {
  it("shows an origin filter and designer fact only for an explicit verified fixture", () => {
    const sourceStone = JW_STONE_NAMED_CATALOG[0];
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
        <BuyerWorkspace
          state={{
            buyer: "designer",
            color: fixtureStone.colorDirection,
            material: null,
            finish: null,
            origin: null,
            stone: null,
          }}
          catalog={[fixtureStone]}
          savedCount={0}
          isSaved={() => false}
          onChangeBuyer={vi.fn()}
          onChangeColor={vi.fn()}
          onUpdateFilters={vi.fn()}
          onToggleSaved={vi.fn()}
          onOpen={vi.fn()}
          onAsk={vi.fn()}
        />
      );
    });

    expect(
      container.querySelector('select[aria-label="Filter by verified country of origin"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("Brazil");

    act(() => root.unmount());
    container.remove();
  });
});
