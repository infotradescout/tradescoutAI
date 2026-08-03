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

function visibleCollectionIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-stone-card]"))
    .map((card) => card.dataset.stoneId)
    .filter((id): id is string => Boolean(id));
}

describe("JW Stone 2.0 marketplace", () => {
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

  it("locks the approved header, restored hero copy, footer, and protected shell", () => {
    expect(container.querySelector('a[aria-label="JW Stone marketplace home"]')).not.toBeNull();
    expect(buttonContaining(container, "Start a Request")).not.toBeNull();
    expect(container.textContent).toContain("JW Stone · A new way to discover stone");
    expect(container.textContent).toContain("Natural stone, selected at the source.");
    expect(container.textContent).toContain(
      "Search the full collection or ask JW Stone about your project."
    );
    expect(container.textContent).toContain("Begin your selection");
    expect(container.textContent).toContain(
      "Stone discovery on your terms. Saving never starts a request."
    );
    expect(container.textContent).not.toContain("Stone chosen around the way you see a project");
    expect(container.textContent).not.toContain("Begin with your point of view");

    const hero = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-hero"]');
    const heroImage = hero?.querySelector<HTMLImageElement>(
      'img[src="/images/businesses/jw-stone/video/hero-poster.jpg"]'
    );
    const heroVeil = hero?.querySelector<HTMLElement>("div.absolute.inset-0.-z-10");
    expect(heroImage?.className).toBe("absolute inset-0 -z-20 h-full w-full object-cover");
    expect(heroVeil?.className).toContain("from-black/55");
    expect(heroVeil?.className).toContain("via-black/15");
    expect(heroVeil?.className).toContain("to-transparent");
  });

  it("shows real stone and independent refinements without asking the visitor anything", () => {
    expect(container.querySelector('[data-testid="customer-path-guide"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="customer-path-panel"]')).toBeNull();
    expect(container.textContent).toContain("Current Inventory");
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(24);
    expect(
      container.querySelector('select[aria-label="Filter by color direction"]')
    ).not.toBeNull();
    expect(container.querySelector('select[aria-label="Filter by material"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Filter by finish"]')).not.toBeNull();
    expect(
      container.querySelector('select[aria-label="Filter by verified country of origin"]')
    ).toBeNull();

    click(container.querySelector('button[aria-label^="Open "][aria-label$=" gallery"]'));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(window.location.search).toContain("stone=");
    expect(window.location.search).not.toContain("buyer=");
    expect(window.location.search).not.toContain("color=");
  });

  it("uses each customer path as one-click knowledge without changing the collection", () => {
    const initialIds = visibleCollectionIds(container);
    const paths = [
      ["Fabricators", "fabricator", "More documented selections"],
      ["Builders & Developers", "builder", "More source records to review"],
      ["Architects & Designers", "designer", "JW Stone Picks"],
      ["Homeowners", "homeowner", "A starting edit"],
    ] as const;

    for (const [label, id, railTitle] of paths) {
      click(buttonContaining(container, label));
      const panel = container.querySelector<HTMLElement>('[data-testid="customer-path-panel"]');
      expect(panel?.dataset.customerPath).toBe(id);
      expect(panel?.textContent).toContain(railTitle);
      expect(panel?.querySelectorAll('a[target="_blank"]')).toHaveLength(2);
      expect(panel?.querySelectorAll(`button[aria-label^="Open "]`)).toHaveLength(6);
      expect(panel?.textContent).not.toMatch(/best for|ideal for|live availability|available now/i);
      expect(visibleCollectionIds(container)).toEqual(initialIds);
      expect(container.querySelector('[data-testid="jw-marketplace-hero"]')).not.toBeNull();
      expect(container.querySelector("#first-cut-title")).not.toBeNull();
      expect(container.querySelector("#current-inventory")).not.toBeNull();
      expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();
      expect(window.location.search).toContain(`buyer=${id}`);
    }
  });

  it("keeps the guidance toolbar compact and horizontal instead of building another stage", () => {
    const guide = container.querySelector<HTMLElement>('[data-testid="customer-path-guide"]');
    const toolbar = container.querySelector<HTMLElement>('[data-testid="customer-path-toolbar"]');
    expect(toolbar?.className).toContain("overflow-x-auto");
    expect(toolbar?.querySelectorAll("button")).toHaveLength(4);
    expect(guide?.className).not.toMatch(/min-h|\bh-screen\b|\bmin-h-screen\b/);

    click(buttonContaining(container, "Homeowners"));
    const panel = container.querySelector<HTMLElement>('[data-testid="customer-path-panel"]');
    expect(panel?.className).not.toMatch(/min-h|\bh-screen\b|\bmin-h-screen\b/);
    expect(panel?.querySelector("button button, select, input")).toBeNull();
  });

  it("treats color and finish as normal optional refinements", () => {
    change(
      container.querySelector<HTMLSelectElement>('select[aria-label="Filter by finish"]'),
      "polished"
    );
    expect(window.location.search).toContain("finish=polished");
    expect(window.location.search).not.toContain("buyer=");
    expect(window.location.search).not.toContain("color=");
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

  it("keeps every active refinement visible when another filter has no overlap", () => {
    const material = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by material"]'
    );
    const color = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by color direction"]'
    );
    const finish = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by finish"]'
    );

    change(material, "onyx");
    change(color, "soft-light");
    expect(material?.value).toBe("onyx");
    expect(material?.querySelector('option[value="onyx"]')).not.toBeNull();
    expect(window.location.search).toContain("material=onyx");
    expect(window.location.search).toContain("color=soft-light");

    change(color, "");
    change(material, "granite");
    change(finish, "honed");
    expect(finish?.value).toBe("honed");
    expect(finish?.querySelector('option[value="honed"]')).not.toBeNull();
    expect(window.location.search).toContain("material=granite");
    expect(window.location.search).toContain("finish=honed");
  });

  it("keeps anonymous catalog presentations nameless and outside product actions", () => {
    const anonymousCard = container.querySelector<HTMLElement>('[data-anonymous="true"]');
    expect(anonymousCard).not.toBeNull();
    expect(anonymousCard?.textContent).toContain("Call for availability");
    expect(anonymousCard?.querySelector('button[aria-label^="Save "]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/trending-selection|Trending Selection\s+\d+/i);
    expect(container.innerHTML).not.toMatch(
      /Unnamed slab|Name not confirmed|Finish not confirmed|Dual Finish/i
    );

    click(
      anonymousCard?.querySelector('button[aria-label="Open this Trending Selection gallery"]') ||
        null
    );
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    if (!dialog) throw new Error("Expected the anonymous detail dialog");
    expect(buttonContaining(dialog, "Ask about this stone")).toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();
  });

  it("persists a named wishlist without requiring a path or opening contact", () => {
    click(container.querySelector<HTMLButtonElement>('button[aria-label^="Save "]'));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();
    expect(window.location.search).not.toContain("buyer=");

    click(buttonContaining(container, "Ask about this stone"));
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).not.toBeNull();
  });

  it("keeps First Cut directly between the hero and the compact guide", () => {
    const hero = container.querySelector('[data-testid="jw-marketplace-hero"]');
    const firstCut = container.querySelector("#first-cut-title")?.closest("section");
    const guide = container.querySelector('[data-testid="customer-path-guide"]');
    const inventory = container.querySelector("#current-inventory");

    expect(hero).not.toBeNull();
    expect(firstCut).not.toBeNull();
    expect(guide).not.toBeNull();
    expect(inventory).not.toBeNull();
    if (!hero || !firstCut || !guide || !inventory) throw new Error("Expected page sections");

    expect(hero.compareDocumentPosition(firstCut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(firstCut.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      guide.compareDocumentPosition(inventory) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const positions = firstCut.querySelectorAll('[data-first-cut-placeholder="true"]');
    expect(positions).toHaveLength(3);
    for (const position of positions)
      expect(position.querySelector("button, a, input, select")).toBeNull();
  });
});
