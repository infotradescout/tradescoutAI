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

describe("JW Stone marketplace luxury layout", () => {
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

  it("locks header, hero, palette, inventory, and bottom Connect without header Connect", () => {
    const header = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-header"]');
    expect(container.querySelector('a[aria-label="JW Stone marketplace home"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-connect"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-connect-cta"]')).not.toBeNull();
    expect(header).not.toBeNull();
    expect(buttonContaining(header!, "Connect")).toBeNull();
    expect(header?.querySelector('[aria-label="Open saved stones, 0 saved"]')).not.toBeNull();
    expect(header?.textContent).not.toMatch(/\b0\b/);
    expect(container.querySelector('[data-testid="jw-marketplace-menu-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-menu-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-footer"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-footer-logo"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="jw-marketplace-tradescout-link"]')?.textContent
    ).toContain("Powered by TradeScout");
    expect(container.textContent).toContain("Natural stone, selected at the source.");
    expect(container.textContent).toContain("Browse inventory");
    expect(container.textContent).toContain("First Cut");
    expect(container.textContent).toContain("Browse by color");
    expect(container.textContent).toContain("All");
    expect(container.textContent).toContain("Warm neutrals");
    expect(container.textContent).toContain("White & light");
    expect(container.textContent).toContain("Gray & silver");
    expect(container.textContent).toContain("Black & dramatic");
    expect(container.textContent).toContain("Brown & earth");
    expect(container.textContent).toContain("Red & burgundy");
    expect(container.textContent).toContain("Multicolor");
    expect(container.textContent).toContain("Browse by material");
    expect(container.textContent).toContain("Granite");
    expect(container.textContent).toContain("Marble");
    expect(container.textContent).toContain("Quartzite");
    expect(container.textContent).toContain("Explore the collection");
    expect(container.textContent).toContain("Contact");
    expect(container.textContent).not.toContain("Tell JW Stone what you need");
    expect(container.textContent).not.toContain("From source to finished space");
    expect(container.textContent).not.toContain("Trending");
    expect(container.textContent).not.toContain("JW Stone Picks");
    expect(container.textContent).not.toContain("Current Inventory");
    expect(container.textContent).not.toMatch(/Basalt\s*—\s*1 selection/i);
    expect(container.querySelector('[data-testid="jw-marketplace-story"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-trending"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-request"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-palette-rail"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-material-rail"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-inventory-categories"]')).toBeNull();

    const request = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-request"]');
    expect(request?.className).toMatch(/fixed/);

    expect(header?.className).toMatch(/bg-\[var\(--jw-surface\)\]|bg-\[var\(--jw-bg\)\]/);
    expect(header?.className).not.toMatch(/shadow/);
    const logo = container.querySelector<HTMLImageElement>('[data-testid="jw-marketplace-logo"]');
    expect(logo?.getAttribute("src")).toBe("/images/businesses/jw-stone/logo.svg");
    expect(logo?.className).not.toMatch(/brightness-0|invert/);

    const hero = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-hero"]');
    const heroVideo = hero?.querySelector<HTMLVideoElement>("video");
    expect(heroVideo).not.toBeNull();
    expect(heroVideo?.getAttribute("poster")).toBe(
      "/images/businesses/jw-stone/video/hero-poster.jpg"
    );
    expect(heroVideo?.className).toContain("max-w-[1920px]");
    expect(hero?.innerHTML).toMatch(/bg-gradient-to-t/);
    const title = hero?.querySelector("#jw-marketplace-title");
    expect(title).not.toBeNull();
    expect(title?.closest(".absolute")).toBeNull();

    const branded = container.querySelector<HTMLElement>('[data-jw-brand="true"]');
    expect(branded).not.toBeNull();
    expect(branded?.style.getPropertyValue("--jw-accent").trim()).toBe("#a8b86c");
    expect(branded?.style.getPropertyValue("--jw-bg").trim()).toBe("#f5f0e6");
    expect(branded?.style.getPropertyValue("--jw-dark").trim()).toBe("#2a2724");
    expect(branded?.className).toMatch(/pb-\[calc\(5\.75rem/);
    expect(document.documentElement.classList.contains("jw-marketplace-scroll")).toBe(true);
  });

  it("keeps section links behind the menu and opens Connect from the menu", () => {
    const header = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-header"]');
    expect(header).not.toBeNull();
    if (!header) throw new Error("Expected header");

    click(container.querySelector('[data-testid="jw-marketplace-menu-button"]'));
    const panel = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-menu-panel"]');
    expect(panel).not.toBeNull();
    if (!panel) throw new Error("Expected menu panel");
    expect(panel.querySelector('a[href="#first-cut-title"]')?.textContent).toContain("First Cut");
    expect(panel.querySelector('a[href="#jw-palette-rail"]')?.textContent).toContain(
      "Browse by color"
    );
    expect(panel.querySelector('a[href="#jw-material-rail"]')?.textContent).toContain(
      "Browse by material"
    );
    expect(panel.querySelector('a[href="#current-inventory"]')?.textContent).toContain(
      "Explore the collection"
    );
    expect(panel.querySelector('a[href="#new-arrivals"]')).toBeNull();
    expect(panel.querySelector('a[href="#jw-story"]')).toBeNull();
    expect(buttonContaining(panel, "Connect")).not.toBeNull();
    expect(header.querySelector('[data-testid="jw-marketplace-connect"]')).toBeNull();

    click(buttonContaining(panel, "Connect"));
    expect(container.querySelector('[data-testid="jw-marketplace-menu-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).not.toBeNull();
  });

  it("opens Express Direct Connect from the sticky Connect CTA", () => {
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();
    click(container.querySelector('[data-testid="jw-marketplace-connect-cta"]'));
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).not.toBeNull();
  });

  it("shows editorial collection chrome: search + Filter sheet, no Ask on cards", () => {
    expect(container.textContent).toContain("Explore the collection");
    expect(container.querySelector('[data-testid="jw-inventory-categories"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-rail"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-stone-card]").length).toBeGreaterThan(20);
    expect(container.querySelector('input[aria-label="Search the collection"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Color"]')).toBeNull();
    expect(container.querySelector('select[aria-label="Material"]')).toBeNull();
    expect(container.querySelector('select[aria-label="Finish"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-filters-sheet-open"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/Basalt\s*—\s*1 selection/i);
    expect(container.textContent).not.toContain("DETAILS PENDING");
    expect(container.textContent).not.toContain("Details pending");

    const firstCard = container.querySelector<HTMLElement>("[data-stone-card]");
    expect(firstCard).not.toBeNull();
    if (!firstCard) throw new Error("Expected a stone card");
    expect(buttonContaining(firstCard, "Ask")).toBeNull();
    expect(buttonContaining(firstCard, "View gallery")).toBeNull();
    expect(buttonContaining(firstCard, "View stone")).not.toBeNull();
    expect(firstCard.className).not.toMatch(/\bborder\b/);
    expect(firstCard.querySelector("[class*='aspect-']")).not.toBeNull();
    expect(firstCard.querySelector('button[aria-label^="Save "]')).not.toBeNull();
    expect(firstCard.textContent).toContain("Pairs with");
    expect(firstCard.querySelector('[aria-label^="Colors #"]')).not.toBeNull();
    expect(firstCard.querySelector('[aria-label^="Pairs with #"]')).not.toBeNull();
    expect(firstCard.querySelector("img")?.className).toMatch(/object-contain/);

    const inventory = container.querySelector('[data-testid="jw-inventory-grid"]');
    expect(inventory?.querySelector("ul")?.className).toMatch(/flex-col/);
    expect(inventory?.querySelector("ul")?.className).not.toMatch(/grid-cols-/);

    click(container.querySelector('[data-testid="jw-material-marble"]'));
    expect(window.location.search).toContain("material=marble");
    for (const card of container.querySelectorAll<HTMLElement>("[data-stone-card]")) {
      expect(card.textContent).toMatch(/Marble/i);
    }

    click(container.querySelector('[data-testid="jw-filters-sheet-open"]'));
    expect(container.querySelector('[data-testid="jw-filters-sheet"]')).not.toBeNull();
    change(container.querySelector<HTMLSelectElement>('select[aria-label="Material"]'), "granite");
    click(buttonContaining(container.querySelector('[data-testid="jw-filters-sheet"]')!, "Show"));
    expect(window.location.search).toContain("material=granite");
    for (const card of container.querySelectorAll<HTMLElement>("[data-stone-card]")) {
      expect(card.textContent).toMatch(/Granite/i);
    }
  });

  it("ignores legacy buyer and finish query params", () => {
    act(() => root.unmount());
    window.history.replaceState(null, "", "/jw-stone?buyer=homeowner&finish=polished");
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));

    expect(window.location.search).not.toContain("finish=");
    expect(window.location.search).not.toContain("buyer=");
    expect(container.querySelectorAll("[data-stone-card]").length).toBeGreaterThan(20);
  });

  it("treats palette, color, and material as optional refinements", () => {
    click(container.querySelector('[data-testid="jw-palette-warm-neutrals"]'));
    expect(window.location.search).toContain("aesthetic=warm-earthy");
    expect(window.location.search).not.toContain("color=");

    click(container.querySelector('[data-testid="jw-palette-green"]'));
    expect(window.location.search).toContain("color=green");
    expect(window.location.search).not.toContain("aesthetic=");

    click(container.querySelector('[data-testid="jw-palette-all"]'));
    expect(window.location.search).not.toContain("aesthetic=");
    expect(window.location.search).not.toContain("color=");

    click(container.querySelector('[data-testid="jw-palette-warm-neutrals"]'));
    click(container.querySelector('[data-testid="jw-material-quartzite"]'));
    expect(window.location.search).toContain("material=quartzite");
    expect(window.location.search).toContain("aesthetic=warm-earthy");

    click(container.querySelector('[data-testid="jw-filters-sheet-open"]'));
    change(container.querySelector<HTMLSelectElement>('select[aria-label="Color"]'), "white");
    change(container.querySelector<HTMLSelectElement>('select[aria-label="Material"]'), "granite");
    click(buttonContaining(container.querySelector('[data-testid="jw-filters-sheet"]')!, "Show"));
    expect(window.location.search).toContain("color=white");
    expect(window.location.search).toContain("aesthetic=warm-earthy");
    expect(window.location.search).toContain("material=granite");
  });

  it("keeps Call for availability theater out and omits empty New Arrivals", () => {
    expect(container.textContent).not.toContain("Call for availability");
    expect(container.querySelector('[data-testid="jw-new-arrivals"]')).toBeNull();
    expect(container.textContent).not.toContain("New Arrivals");
  });

  it("persists a named wishlist without opening contact and hides zero badge", () => {
    expect(container.querySelector('[aria-label="Open saved stones, 0 saved"]')).not.toBeNull();
    const badge = container.querySelector(
      '[aria-label="Open saved stones, 0 saved"] .rounded-full'
    );
    expect(badge).toBeNull();

    click(container.querySelector<HTMLButtonElement>('button[aria-label^="Save "]'));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();
  });

  it("orders header, hero, First Cut peek, color, material, inventory, footer, then Connect", () => {
    const header = container.querySelector('[data-testid="jw-marketplace-header"]');
    const hero = container.querySelector('[data-testid="jw-marketplace-hero"]');
    const firstCut = container.querySelector("#first-cut-title")?.closest("section");
    const palette = container.querySelector('[data-testid="jw-palette-rail"]');
    const materials = container.querySelector('[data-testid="jw-material-rail"]');
    const inventory = container.querySelector("#current-inventory");
    const footer = container.querySelector('[data-testid="jw-marketplace-footer"]');
    const request = container.querySelector('[data-testid="jw-marketplace-request"]');

    expect(header).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(firstCut).not.toBeNull();
    expect(palette).not.toBeNull();
    expect(materials).not.toBeNull();
    expect(inventory).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(request).not.toBeNull();
    if (
      !header ||
      !hero ||
      !firstCut ||
      !palette ||
      !materials ||
      !inventory ||
      !footer ||
      !request
    ) {
      throw new Error("Expected page sections");
    }

    expect(header.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hero.compareDocumentPosition(firstCut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      firstCut.compareDocumentPosition(palette) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      palette.compareDocumentPosition(materials) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      materials.compareDocumentPosition(inventory) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      inventory.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(footer.compareDocumentPosition(request) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(inventory.className).toMatch(/scroll-mt-/);

    const rail = firstCut.querySelector('[data-testid="jw-first-cut-rail"]');
    expect(rail?.className).toMatch(/snap-x/);
    expect(rail?.className).not.toMatch(/grid-cols-3/);
    const photoSlots = firstCut.querySelectorAll('[data-first-cut-photo="true"]');
    expect(photoSlots.length).toBe(3);
    for (const slot of Array.from(photoSlots)) {
      expect(slot.querySelector("img")).not.toBeNull();
      expect(slot.className).toMatch(/w-\[88vw\]|w-\[86vw\]/);
      expect(slot.textContent?.trim()).toBe("");
    }
    expect(firstCut.textContent).toContain(
      "Newly sourced by JW Stone. Names and specifications are added as inventory is confirmed."
    );
    expect(firstCut.textContent).not.toMatch(/Details pending/i);
    expect(firstCut.className).not.toMatch(/darkBar|jw-dark|--jw-dark/);
  });
});
