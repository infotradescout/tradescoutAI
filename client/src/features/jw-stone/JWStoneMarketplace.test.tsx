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

type DirectConnectMockProps = {
  open: boolean;
  initialStoneSelections?: Array<{ itemName: string }>;
};

vi.mock("@/pages/profile-sites/ExpressDirectConnectPanel", () => ({
  default: ({ open, initialStoneSelections }: DirectConnectMockProps) =>
    open ? (
      <div data-testid="direct-connect-panel">
        {initialStoneSelections?.map((selection) => selection.itemName).join(", ") ||
          "General request"}
      </div>
    ) : null,
}));

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

function change(element: HTMLInputElement | HTMLSelectElement | null, value: string) {
  if (!element) throw new Error("Expected a form control");
  act(() => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function buttonContaining(container: ParentNode, text: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes(text)
    ) || null
  );
}

describe("JW Stone marketplace end-user reset", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.history.replaceState(null, "", "/jw-stone");
    window.localStorage.clear();
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

  it("locks the approved header, hero, inventory, learn section, and footer", () => {
    expect(container.querySelector('a[aria-label="JW Stone marketplace home"]')).not.toBeNull();
    expect(buttonContaining(container, "Start a Request")).not.toBeNull();
    expect(container.textContent).toContain("JW Stone · A new way to discover stone");
    expect(container.textContent).toContain("Natural stone, selected at the source.");
    expect(container.textContent).toContain(
      "Search the full collection or ask JW Stone about your project."
    );
    expect(container.textContent).toContain("Browse current inventory");
    expect(container.textContent).toContain("Learn about stone");
    expect(container.textContent).toContain(
      "Stone discovery on your terms. Saving never starts a request."
    );
    expect(container.querySelector('[data-testid="customer-path-guide"]')).toBeNull();
    expect(container.textContent).not.toContain("Fabricators");
    expect(container.textContent).not.toContain("Begin with your point of view");

    const hero = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-hero"]');
    const heroImage = hero?.querySelector<HTMLImageElement>(
      'img[src="/images/businesses/jw-stone/video/hero-poster.jpg"]'
    );
    expect(heroImage?.className).toBe("absolute inset-0 -z-20 h-full w-full object-cover");
  });

  it("shows inventory without requiring a customer path", () => {
    expect(container.textContent).toContain("Current Inventory");
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(24);
    expect(
      container.querySelector('select[aria-label="Filter by color direction"]')
    ).not.toBeNull();
    expect(container.querySelector('select[aria-label="Filter by material"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Filter by finish"]')).not.toBeNull();

    click(container.querySelector('button[aria-label^="Open "][aria-label$=" gallery"]'));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(window.location.search).toContain("stone=");
    expect(window.location.search).not.toContain("buyer=");
    expect(window.location.search).not.toContain("color=");
  });

  it("ignores legacy buyer query params", () => {
    act(() => root.unmount());
    window.history.replaceState(null, "", "/jw-stone?buyer=homeowner&finish=polished");
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));

    expect(container.querySelector('[data-testid="customer-path-guide"]')).toBeNull();
    expect(container.querySelector('[data-testid="customer-path-panel"]')).toBeNull();
    change(
      container.querySelector<HTMLSelectElement>('select[aria-label="Filter by color direction"]'),
      "warm-earthy"
    );
    expect(window.location.search).toContain("color=warm-earthy");
    expect(window.location.search).toContain("finish=polished");
    expect(window.location.search).not.toContain("buyer=");
  });

  it("treats color and finish as normal optional refinements", () => {
    change(
      container.querySelector<HTMLSelectElement>('select[aria-label="Filter by finish"]'),
      "polished"
    );
    expect(window.location.search).toContain("finish=polished");
    expect(window.location.search).not.toContain("buyer=");
    for (const card of container.querySelectorAll<HTMLElement>("[data-stone-card]")) {
      expect(card.textContent).toContain("Polished");
    }

    change(
      container.querySelector<HTMLSelectElement>('select[aria-label="Filter by color direction"]'),
      "warm-earthy"
    );
    expect(window.location.search).toContain("color=warm-earthy");
    expect(window.location.search).toContain("finish=polished");
  });

  it("keeps anonymous catalog presentations nameless and outside product actions", () => {
    const anonymousCard = container.querySelector<HTMLElement>('[data-anonymous="true"]');
    expect(anonymousCard).not.toBeNull();
    expect(anonymousCard?.textContent).toContain("Call for availability");
    expect(anonymousCard?.querySelector('button[aria-label^="Save "]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/trending-selection|Trending Selection\s+\d+/i);

    click(
      anonymousCard?.querySelector('button[aria-label="Open this Trending Selection gallery"]') ||
        null
    );
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    if (!dialog) throw new Error("Expected the anonymous detail dialog");
    expect(buttonContaining(dialog, "Ask about this stone")).toBeNull();
  });

  it("persists a named wishlist without opening contact", () => {
    click(container.querySelector<HTMLButtonElement>('button[aria-label^="Save "]'));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();

    click(buttonContaining(container, "Ask about this stone"));
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).not.toBeNull();
  });

  it("orders hero, First Cut, inventory, then learn about stone", () => {
    const hero = container.querySelector('[data-testid="jw-marketplace-hero"]');
    const firstCut = container.querySelector("#first-cut-title")?.closest("section");
    const inventory = container.querySelector("#current-inventory");
    const learn = container.querySelector('[data-testid="stone-learning"]');

    expect(hero).not.toBeNull();
    expect(firstCut).not.toBeNull();
    expect(inventory).not.toBeNull();
    expect(learn).not.toBeNull();
    if (!hero || !firstCut || !inventory || !learn) throw new Error("Expected page sections");

    expect(hero.compareDocumentPosition(firstCut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      firstCut.compareDocumentPosition(inventory) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      inventory.compareDocumentPosition(learn) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const positions = firstCut.querySelectorAll('[data-first-cut-placeholder="true"]');
    expect(positions).toHaveLength(3);
    expect(learn.querySelectorAll('a[target="_blank"]')).toHaveLength(4);
  });
});
