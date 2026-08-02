// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JWStoneMarketplace from "./JWStoneMarketplace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock("@/components/SEOHelmet", () => ({
  SEOHelmet: () => null,
}));

vi.mock("@/pages/profile-sites/ExpressDirectConnectPanel", () => ({
  default: ({ open, initialStoneSelections }: any) =>
    open ? (
      <div data-testid="direct-connect-panel">
        {initialStoneSelections?.map((selection: any) => selection.itemName).join(", ") ||
          "General request"}
      </div>
    ) : null,
}));

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function buttonContaining(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes(text)
    ) || null
  );
}

describe("JW Stone 2.0 marketplace journey", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.history.replaceState(null, "", "/jw-stone");
    window.localStorage.clear();
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal(
      "matchMedia",
      vi
        .fn()
        .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("requires buyer and then color before any inventory renders", () => {
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(0);
    expect(container.querySelector('[data-testid="buyer-selection"]')).not.toBeNull();

    click(buttonContaining(container, "I’m a fabricator"));
    expect(container.querySelector('[data-testid="color-selection"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(0);

    click(buttonContaining(container, "Soft & Light"));
    expect(container.querySelector('[data-testid="fabricator-workspace"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-stone-card]").length).toBeGreaterThan(0);
    expect(
      container.querySelector('select[aria-label="Filter by verified country of origin"]')
    ).toBeNull();
  });

  it("renders four materially different buyer workspaces", () => {
    const journeys = [
      ["I’m a fabricator", "fabricator-workspace", "Source bundle counts are shown"],
      ["I’m a builder", "builder-workspace", "Project selection"],
      ["I’m a designer", "designer-workspace", "Visual edit"],
      ["I’m a homeowner", "homeowner-workspace", "shortlist"],
    ] as const;

    for (const [buyer, testId, distinctiveCopy] of journeys) {
      click(buttonContaining(container, buyer));
      click(buttonContaining(container, "Soft & Light"));
      expect(container.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
      expect(container.textContent).toContain(distinctiveCopy);
      click(
        buttonContaining(
          container,
          buyer.replace("I’m a ", "").replace(/^./, (c) => c.toUpperCase())
        )
      );
    }
  });

  it("keeps anonymous inventory nameless and outside save controls and public state", () => {
    click(buttonContaining(container, "I’m a homeowner"));
    click(buttonContaining(container, "Bold & Expressive"));

    const anonymousCard = container.querySelector<HTMLElement>('[data-anonymous="true"]');
    expect(anonymousCard).not.toBeNull();
    expect(anonymousCard?.textContent).toContain("Call for availability");
    expect(anonymousCard?.querySelector('button[aria-label^="Save "]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/trending-selection|Trending Selection\s+\d+/i);
    expect(container.innerHTML).not.toMatch(
      /Unnamed slab|Name not confirmed|Finish not confirmed|Dual Finish/i
    );
  });

  it("persists a named wishlist without opening contact", () => {
    click(buttonContaining(container, "I’m a designer"));
    click(buttonContaining(container, "Soft & Light"));

    const saveButton = container.querySelector<HTMLButtonElement>('button[aria-label^="Save "]');
    click(saveButton);

    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();

    click(buttonContaining(container, "Ask about it"));
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).not.toBeNull();
  });

  it("keeps First Cut reveal positions outside every product action", () => {
    const positions = Array.from(
      container.querySelectorAll<HTMLElement>('[data-first-cut-placeholder="true"]')
    );
    expect(positions).toHaveLength(3);
    for (const position of positions) {
      expect(position.querySelector("button, a, input, select")).toBeNull();
      expect(position.getAttribute("data-stone-card")).toBeNull();
    }
  });
});
