// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JWStoneMarketplace from "./JWStoneMarketplace";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const authState = vi.hoisted(() => ({
  user: null as { id: number; email: string } | null,
  isAuthenticated: false,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
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
    authState.user = null;
    authState.isAuthenticated = false;
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

  it("locks the marketplace layout and keeps JW Stone company identity public", () => {
    const marketplace = container.querySelector<HTMLElement>('[data-jw-brand="true"]');
    const header = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-header"]');
    expect(marketplace?.className).toMatch(/overflow-x-clip/);
    expect(marketplace?.className).not.toMatch(/overflow-x-visible/);
    expect(container.querySelector('a[aria-label="JW Stone marketplace home"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-connect"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-connect-cta"]')).not.toBeNull();
    expect(header).not.toBeNull();
    expect(buttonContaining(header!, "Connect")).toBeNull();
    expect(header?.querySelector('[aria-label="Open saved stones, 0 saved"]')).not.toBeNull();
    expect(header?.textContent).not.toMatch(/\b0\b/);
    expect(container.querySelector('[data-testid="jw-marketplace-menu-button"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-menu-panel"]')).toBeNull();
    const footer = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-footer"]');
    expect(footer).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-footer-logo"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="jw-marketplace-tradescout-link"]')?.textContent
    ).toContain("Powered by TradeScout");
    expect(footer?.querySelector('a[href="#first-cut-title"]')).toBeNull();
    expect(footer?.querySelector('a[href="#jw-palette-rail"]')).toBeNull();
    expect(footer?.querySelector('a[href="#jw-material-rail"]')).toBeNull();
    expect(footer?.querySelector('a[href="#current-inventory"]')).toBeNull();
    expect(footer?.querySelector('a[href="/u/jw-stone"]')).not.toBeNull();
    expect(footer?.querySelector('nav[aria-label="JW Stone sections"]')).toBeNull();
    expect(container.textContent).toContain("Natural stone, selected at the source.");
    const companyIdentity = container.querySelector<HTMLElement>(
      '[data-testid="jw-company-identity"]'
    );
    expect(companyIdentity).not.toBeNull();
    expect(companyIdentity?.textContent).toContain("About JW Stone");
    expect(companyIdentity?.textContent).toContain(
      "Founded in 2017 by Jared and Wagner, JW Stone gives customers direct access to hand-selected natural stone, with one expert overseeing the journey from quarry selection through processing and delivery."
    );
    expect(companyIdentity?.textContent).toContain("2103 W Herman Ave");
    expect(companyIdentity?.textContent).toContain("Pensacola, FL 32505");
    expect(companyIdentity?.textContent).toContain("@jwstonellc");
    expect(companyIdentity?.textContent).toContain("JW Stone Logistics");
    expect(companyIdentity?.querySelector('[data-testid="jw-managed-contact-phone"]')).toBeNull();
    expect(companyIdentity?.querySelector('a[href^="tel:"]')).toBeNull();
    expect(companyIdentity?.querySelector('a[href^="https://www.google.com/maps"]')).toBeNull();
    expect(
      companyIdentity?.querySelector('[data-testid="jw-social-instagram"]')?.getAttribute("href")
    ).toBe("https://www.instagram.com/jwstonellc/");
    expect(
      companyIdentity?.querySelector('[data-testid="jw-social-facebook"]')?.getAttribute("href")
    ).toBe("https://www.facebook.com/people/JW-Stone-Logistics/100094713955142/");
    expect(
      companyIdentity?.querySelector('[data-testid="jw-social-youtube"]')?.getAttribute("href")
    ).toBe("https://www.youtube.com/@JWStoneLogistics");
    expect(container.textContent).not.toContain("Why JW Stone");
    expect(container.textContent).not.toContain("How do I confirm availability or pricing?");
    expect(container.querySelector('[data-testid="jw-marketplace-trust"]')).toBeNull();
    expect(container.textContent).not.toContain(
      "Thirty years of expertise for fabricators, architects, designers, builders, and homeowners."
    );
    expect(container.textContent).not.toContain("Browse inventory");
    expect(
      container.querySelector('[data-testid="jw-marketplace-hero"] a[href="#current-inventory"]')
    ).toBeNull();
    expect(container.textContent).not.toContain("View First Cut");
    expect(container.textContent).not.toContain("Open for palette filters");
    expect(container.textContent).not.toContain("Open for stacked materials");
    expect(container.textContent).not.toContain("expand to search and browse");
    expect(container.textContent).toContain("First Cut");
    expect(container.textContent).toContain("Browse by color");
    expect(container.textContent).toContain("Browse by mood");
    expect(container.textContent).toContain("Browse by material");
    expect(container.textContent).toContain("Full inventory");
    expect(container.textContent).toContain(
      "JW Stone sources and supplies natural stone with quarry-direct pricing and coordinated delivery."
    );
    expect(container.textContent).toContain(
      "JW Stone does not template, fabricate, finish, or install countertops; those services require a separate independent fabricator."
    );
    expect(container.textContent).not.toContain("JW Stone handles the entire process");
    expect(container.textContent).not.toContain("Installed spaces");
    expect(container.textContent).not.toContain("Finished work");
    expect(container.querySelector("#jw-finished-work-heading")).toBeNull();
    expect(container.querySelector('[data-testid="jw-finished-work-bridge"]')).toBeNull();
    expect(container.textContent).not.toContain("Wagner at the quarry");
    expect(container.textContent).toContain("Finished-space inspiration");
    expect(container.textContent).toContain("Stone specified for the whole space");
    expect(container.textContent).toContain("Material with architectural impact");
    expect(container.textContent).toContain("Direct quarry relationships");
    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(
      container.querySelector('[data-testid="jw-material-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-palette-all"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-stack"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-inventory-grid"]')).toBeNull();
    expect(container.querySelectorAll("[data-stone-card]").length).toBe(0);
    expect(container.textContent).toContain("Start a Request");
    expect(container.textContent).not.toContain("Tell JW Stone what you need");
    expect(container.textContent).toContain("From source to finished space");
    expect(container.textContent).not.toContain("Trending");
    expect(container.textContent).not.toContain("JW Stone Picks");
    expect(container.textContent).not.toContain("Current Inventory");
    expect(container.textContent).not.toContain("Explore the collection");
    expect(container.querySelector('[data-testid="jw-marketplace-story"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="jw-marketplace-story"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="jw-marketplace-trending"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-request"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-palette-rail"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-material-rail"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-inventory-categories"]')).toBeNull();

    const colorToggle = container.querySelector('[data-testid="jw-palette-rail-toggle"]');
    const moodToggle = container.querySelector('[data-testid="jw-mood-rail-toggle"]');
    const materialToggle = container.querySelector('[data-testid="jw-material-rail-toggle"]');
    const inventoryToggle = container.querySelector('[data-testid="jw-inventory-toggle"]');
    // One calm cue only — never dual "Tap to open" (under-title + pill).
    expect(container.textContent).not.toMatch(/Tap to open/i);
    expect(container.querySelectorAll('[data-testid$="-expand-hint"]')).toHaveLength(0);
    expect(
      colorToggle?.querySelector('[data-testid="jw-palette-rail-expand-cue"]')?.textContent
    ).toMatch(/^Open$/);
    expect(
      moodToggle?.querySelector('[data-testid="jw-mood-rail-expand-cue"]')?.textContent
    ).toMatch(/^Open$/);
    expect(
      materialToggle?.querySelector('[data-testid="jw-material-rail-expand-cue"]')?.textContent
    ).toMatch(/^Open$/);
    expect(
      inventoryToggle?.querySelector('[data-testid="jw-inventory-expand-cue"]')?.textContent
    ).toMatch(/^Open$/);
    expect(colorToggle?.querySelector('[data-testid="jw-color-collage"]')).not.toBeNull();
    expect(
      colorToggle
        ?.querySelector('[data-testid="jw-color-collage"]')
        ?.getAttribute("data-page-count")
    ).toBeNull();
    expect(colorToggle?.querySelector('[data-testid="jw-color-collage-track"]')).toBeNull();
    expect(colorToggle?.querySelector('[data-testid="jw-color-collage-page-0"]')).toBeNull();
    const collageSrcs = Array.from(
      colorToggle?.querySelectorAll('[data-testid="jw-color-collage"] img') || []
    ).map((img) => img.getAttribute("src") || "");
    expect(collageSrcs).toHaveLength(8);
    expect(collageSrcs.every((src) => src.includes("/color-collage/"))).toBe(true);
    expect(collageSrcs.every((src) => src.includes("v=face-5"))).toBe(true);
    expect(collageSrcs.some((src) => src.includes("04-black.webp"))).toBe(true);
    expect(collageSrcs.some((src) => src.includes("07-blue.webp"))).toBe(true);
    expect(collageSrcs.some((src) => src.includes("09-gold.webp"))).toBe(true);
    expect(collageSrcs.some((src) => src.includes("/black-pearl/"))).toBe(false);

    expect(moodToggle?.querySelector("img")?.getAttribute("src")).toContain(
      "/story/taj-living-room.webp"
    );

    expect(materialToggle?.querySelector('[data-testid="jw-material-collage"]')).not.toBeNull();
    expect(
      materialToggle
        ?.querySelector('[data-testid="jw-material-collage"]')
        ?.getAttribute("data-page-count")
    ).toBeNull();
    expect(materialToggle?.querySelector('[data-testid="jw-material-collage-page-0"]')).toBeNull();
    const materialSrcs = Array.from(
      materialToggle?.querySelectorAll('[data-testid="jw-material-collage"] img') || []
    ).map((img) => img.getAttribute("src") || "");
    expect(materialSrcs).toHaveLength(1);
    expect(materialSrcs[0]).toContain("/inventory-source/10hwbokQWc-hgPGqXhdKkuLRjs4a6Zbfd.webp");
    expect(materialSrcs[0]).not.toContain("/material-covers/");
    expect(materialSrcs[0]).not.toContain("/color-collage/");
    expect(materialSrcs[0]).not.toContain("/story/");

    expect(inventoryToggle?.querySelector('[data-testid="jw-inventory-collage"]')).not.toBeNull();
    expect(
      inventoryToggle
        ?.querySelector('[data-testid="jw-inventory-collage"]')
        ?.getAttribute("data-page-count")
    ).toBeNull();
    expect(
      inventoryToggle?.querySelector('[data-testid="jw-inventory-collage-page-0"]')
    ).toBeNull();
    const inventorySrcs = Array.from(
      inventoryToggle?.querySelectorAll('[data-testid="jw-inventory-collage"] img') || []
    ).map((img) => img.getAttribute("src") || "");
    expect(inventorySrcs).toHaveLength(1);
    expect(inventorySrcs[0]).toContain("/story/full-inventory-yard.webp");
    expect(inventorySrcs[0]).not.toContain("taj-living-room");
    expect(inventorySrcs[0]).not.toBe(materialSrcs[0]);
    expect(inventorySrcs[0]).not.toContain("/material-covers/");
    expect(inventorySrcs[0]).not.toContain("/color-collage/");
    expect(inventorySrcs[0]).not.toContain("/inventory-source/");

    const story = container.querySelector('[data-testid="jw-marketplace-story"]');
    expect(story?.getAttribute("id")).toBe("jw-story");
    expect(story?.textContent).toContain("From source to finished space");
    expect(story?.textContent).toContain("Stone selected with the final room in mind");
    expect(story?.textContent).toContain(
      "JW Stone sources and supplies natural stone with quarry-direct pricing and coordinated delivery."
    );
    expect(story?.textContent).toContain(
      "JW Stone does not template, fabricate, finish, or install countertops; those services require a separate independent fabricator."
    );
    expect(story?.textContent).toContain("Direct quarry relationships");
    expect(story?.textContent).not.toContain("Finished work");
    expect(story?.textContent).not.toContain("Installed spaces");
    expect(container.querySelector('[data-testid="jw-story-separator"]')).not.toBeNull();
    const storySrcs = Array.from(story?.querySelectorAll("img") || []).map(
      (img) => img.getAttribute("src") || ""
    );
    expect(storySrcs.length).toBeGreaterThanOrEqual(4);
    expect(storySrcs[0]).toContain("/story/quarry.webp");
    expect(storySrcs.some((src) => src.includes("/story/taj-living-room.webp"))).toBe(true);
    expect(storySrcs.some((src) => src.includes("/story/fireplace.webp"))).toBe(true);
    const storyRail = story?.querySelector("ul");
    expect(storyRail?.className).toMatch(/overflow-x-auto/);
    expect(storyRail?.className).toMatch(/overscroll-x-contain/);
    expect(storyRail?.className).toContain("[-webkit-overflow-scrolling:touch]");
    expect(storyRail?.className).not.toMatch(/snap-/);
    expect(storySrcs.some((src) => src.includes("/story/mont-blanc-bar.webp"))).toBe(true);
    const footerEl = container.querySelector('[data-testid="jw-marketplace-footer"]');
    const inventoryEl = container.querySelector("#current-inventory");
    expect(
      story &&
        inventoryEl &&
        footerEl &&
        Boolean(inventoryEl.compareDocumentPosition(story) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        Boolean(story.compareDocumentPosition(footerEl) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true);

    expect(colorToggle?.className).toMatch(/min-h-\[25svh\]/);
    expect(materialToggle?.className).toMatch(/min-h-\[25svh\]/);
    expect(inventoryToggle?.className).toMatch(/min-h-\[25svh\]/);

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
    expect(hero?.querySelector('[data-testid="jw-marketplace-hero-image"]')).toBeNull();
    expect(hero?.querySelector('[data-testid="jw-marketplace-hero-brand"]')).toBeNull();
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

  it("shows Account instead of Create account after TradeScout authentication", () => {
    authState.user = { id: 42, email: "owner@example.com" };
    authState.isAuthenticated = true;
    act(() => root.render(<JWStoneMarketplace />));

    const accountButton = container.querySelector('[data-testid="jw-marketplace-account-button"]');
    expect(accountButton?.textContent).toMatch(/^Account$/);
    expect(accountButton?.getAttribute("aria-label")).toBe("Open your TradeScout account");
    expect(accountButton?.textContent).not.toContain("Create account");

    click(container.querySelector('[data-testid="jw-marketplace-menu-button"]'));
    const menu = container.querySelector('[data-testid="jw-marketplace-menu-panel"]');
    expect(menu?.textContent).toContain("Account");
    expect(menu?.textContent).not.toContain("Create account");
  });

  it("opens company navigation and Start a Request from the menu", () => {
    const header = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-header"]');
    expect(header).not.toBeNull();
    if (!header) throw new Error("Expected header");

    click(container.querySelector('[data-testid="jw-marketplace-menu-button"]'));
    const panel = container.querySelector<HTMLElement>('[data-testid="jw-marketplace-menu-panel"]');
    expect(panel).not.toBeNull();
    if (!panel) throw new Error("Expected menu panel");
    expect(panel.querySelector('a[href="#first-cut-title"]')).toBeNull();
    expect(panel.querySelector('a[href="#jw-palette-rail"]')).toBeNull();
    expect(panel.querySelector('a[href="#jw-material-rail"]')).toBeNull();
    expect(panel.querySelector('a[href="#current-inventory"]')).toBeNull();
    expect(panel.querySelector('a[href="#jw-finished-work"]')).toBeNull();
    expect(panel.querySelector('a[href="#new-arrivals"]')).toBeNull();
    expect(panel.querySelector('a[href="#jw-story"]')).toBeNull();
    expect(panel.querySelector('a[href="/u/jw-stone"]')).toBeNull();
    expect(panel.querySelector('a[href="#about-jw-stone"]')?.textContent).toContain("About");
    expect(panel.querySelector('a[href="#jw-stone-location"]')?.textContent).toContain("Visit");
    expect(panel.querySelector('a[href="#jw-stone-socials"]')?.textContent).toContain("Socials");
    expect(buttonContaining(panel, "Start a Request")).not.toBeNull();
    expect(header.querySelector('[data-testid="jw-marketplace-connect"]')).toBeNull();

    click(buttonContaining(panel, "Start a Request"));
    expect(container.querySelector('[data-testid="jw-marketplace-menu-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).not.toBeNull();
  });

  it("opens Express Direct Connect from the sticky Connect CTA", () => {
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();
    click(container.querySelector('[data-testid="jw-marketplace-connect-cta"]'));
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).not.toBeNull();
  });

  it("shows editorial collection chrome: search + Filter sheet, Save/Ask/View on cards", () => {
    expect(container.textContent).toContain("Full inventory");
    expect(container.querySelector('[data-testid="jw-inventory-categories"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-rail"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-stone-card]").length).toBe(0);

    click(container.querySelector('[data-testid="jw-inventory-toggle"]'));
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("true");
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(8);
    expect(container.querySelector('input[aria-label="Search the collection"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="Color"]')).toBeNull();
    expect(container.querySelector('select[aria-label="Material"]')).toBeNull();
    expect(container.querySelector('select[aria-label="Finish"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-filters-sheet-open"]')).not.toBeNull();
    expect(container.textContent).not.toContain("DETAILS PENDING");
    expect(container.textContent).not.toContain("Details pending");

    const firstCard = container.querySelector<HTMLElement>("[data-stone-card]");
    expect(firstCard).not.toBeNull();
    if (!firstCard) throw new Error("Expected a stone card");
    expect(buttonContaining(firstCard, "Ask")).not.toBeNull();
    expect(buttonContaining(firstCard, "View gallery")).toBeNull();
    expect(buttonContaining(firstCard, "View stone")).not.toBeNull();
    expect(firstCard.className).not.toMatch(/\bborder\b/);
    const cardMedia = firstCard.querySelector<HTMLElement>('[data-testid="jw-stone-card-media"]');
    const cardPhotoRail = firstCard.querySelector<HTMLElement>(
      '[data-testid="jw-stone-card-photo-rail"]'
    );
    expect(cardMedia?.className).toMatch(/aspect-\[4\/3\]/);
    expect(cardMedia?.className).toMatch(/overflow-hidden/);
    expect(cardPhotoRail?.className).toMatch(/overflow-x-auto/);
    expect(cardPhotoRail?.className).not.toMatch(/snap-/);
    expect(firstCard.querySelector('button[aria-label^="Save "]')).not.toBeNull();
    expect(firstCard.textContent).not.toContain("Pairs with");
    expect(firstCard.textContent).not.toContain("Colors from photo");
    expect(firstCard.querySelector('[aria-label^="Colors #"]')).toBeNull();
    expect(firstCard.querySelector('[aria-label^="Pairs with #"]')).toBeNull();
    expect(firstCard.querySelector("img")?.className).toMatch(/h-full/);
    expect(firstCard.querySelector("img")?.className).toMatch(/w-full/);
    expect(firstCard.querySelector("img")?.className).toMatch(/object-contain/);
    expect(firstCard.querySelector("img")?.className).not.toMatch(/h-auto|object-cover/);

    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();
    click(buttonContaining(firstCard, "Ask"));
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).not.toBeNull();

    const inventory = container.querySelector('[data-testid="jw-inventory-grid"]');
    expect(inventory?.querySelector("ul")?.className).toMatch(/\bgrid\b/);
    expect(inventory?.querySelector("ul")?.className).toMatch(/sm:grid-cols-2/);
    expect(inventory?.querySelector("ul")?.className).toMatch(/lg:grid-cols-3/);
    expect(inventory?.querySelector("ul")?.className).toMatch(/xl:grid-cols-4/);
    expect(inventory?.querySelector("ul")?.className).not.toMatch(/flex-col/);
    expect(
      container.querySelector('[data-testid="jw-inventory-visible-range"]')?.textContent
    ).toMatch(/^Showing 1–8 of /);
    expect(
      container.querySelector('[data-testid="jw-inventory-page-status-top"]')?.textContent
    ).toMatch(/^Page 1 of /);
    const firstPageFirstStoneId = firstCard.dataset.stoneId;
    click(container.querySelector('[data-testid="jw-inventory-page-next-top"]'));
    expect(container.querySelectorAll("#current-inventory [data-stone-card]")).toHaveLength(8);
    expect(
      container.querySelector('[data-testid="jw-inventory-page-status-top"]')?.textContent
    ).toMatch(/^Page 2 of /);
    expect(
      container.querySelector<HTMLElement>("#current-inventory [data-stone-card]")?.dataset.stoneId
    ).not.toBe(firstPageFirstStoneId);
    const secondPageFirstCard = container.querySelector<HTMLElement>(
      "#current-inventory [data-stone-card]"
    );
    const secondPageStoneName = secondPageFirstCard?.querySelector("h3")?.textContent?.trim();
    expect(secondPageStoneName).toBeTruthy();
    if (!secondPageFirstCard || !secondPageStoneName) {
      throw new Error("Expected a named stone on inventory page two");
    }
    click(buttonContaining(secondPageFirstCard, "Ask"));
    expect(container.querySelector('[data-testid="direct-connect-panel"]')?.textContent).toContain(
      secondPageStoneName
    );
    click(container.querySelector('[data-testid="jw-inventory-page-prev-top"]'));
    expect(
      container.querySelector('[data-testid="jw-inventory-page-status-top"]')?.textContent
    ).toMatch(/^Page 1 of /);

    click(container.querySelector('[data-testid="jw-material-rail-toggle"]'));
    expect(container.querySelector('[data-testid="jw-material-stack"]')?.className).toMatch(
      /flex-col/
    );
    expect(container.querySelector('[data-testid="jw-material-stone-rail"]')).toBeNull();

    click(container.querySelector('[data-testid="jw-material-marble"]'));
    expect(window.location.pathname).toContain("/materials/marble");
    expect(
      container
        .querySelector('[data-testid="jw-material-section-marble"]')
        ?.getAttribute("data-expanded")
    ).toBe("true");
    const marbleRail = container.querySelector('[data-testid="jw-material-stone-rail"]');
    expect(marbleRail).not.toBeNull();
    expect(marbleRail?.querySelector('[data-testid="jw-material-stone-prev"]')).not.toBeNull();
    expect(marbleRail?.querySelector('[data-testid="jw-material-stone-next"]')).not.toBeNull();
    expect(marbleRail?.className).not.toMatch(/overflow-x-auto/);
    const marbleTrack = marbleRail?.querySelector('[data-testid="jw-material-stone-track"]');
    expect(marbleTrack?.className).toMatch(/overflow-x-auto/);
    expect(marbleTrack?.className).not.toMatch(/snap-/);
    expect(marbleRail?.querySelector("[data-stone-card]")?.textContent).toMatch(/Marble/i);
    expect(container.querySelectorAll("[data-stone-card]").length).toBeGreaterThan(1);

    click(container.querySelector('[data-testid="jw-filters-sheet-open"]'));
    expect(container.querySelector('[data-testid="jw-filters-sheet"]')).not.toBeNull();
    change(container.querySelector<HTMLSelectElement>('select[aria-label="Material"]'), "granite");
    click(buttonContaining(container.querySelector('[data-testid="jw-filters-sheet"]')!, "Show"));
    expect(window.location.pathname).toContain("/materials/granite");
    const graniteRail = container.querySelector('[data-testid="jw-material-stone-rail"]');
    expect(graniteRail).not.toBeNull();
    expect(graniteRail?.querySelector("[data-stone-card]")?.textContent).toMatch(/Granite/i);
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("true");
    expect(
      container.querySelectorAll("#current-inventory [data-stone-card]").length
    ).toBeGreaterThan(0);

    click(container.querySelector('[data-testid="jw-material-granite"]'));
    expect(window.location.pathname).not.toMatch(/\/materials\//);
    expect(container.querySelector('[data-testid="jw-material-stone-rail"]')).toBeNull();
  });

  it("ignores legacy buyer and finish query params", () => {
    act(() => root.unmount());
    window.history.replaceState(null, "", "/jw-stone?buyer=homeowner&finish=polished");
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));

    expect(window.location.search).not.toContain("finish=");
    expect(window.location.search).not.toContain("buyer=");
    expect(container.querySelectorAll("[data-stone-card]").length).toBe(0);
    click(container.querySelector('[data-testid="jw-inventory-toggle"]'));
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(8);
  });

  it("treats palette, color, and material as optional refinements", () => {
    click(container.querySelector('[data-testid="jw-palette-rail-toggle"]'));
    click(container.querySelector('[data-testid="jw-palette-beige"]'));
    expect(window.location.search).toContain("color=beige");
    expect(window.location.search).not.toContain("aesthetic=");
    expect(window.location.pathname).not.toMatch(/\/materials\//);

    click(container.querySelector('[data-testid="jw-palette-green"]'));
    expect(window.location.search).toContain("color=green");
    expect(window.location.search).not.toContain("aesthetic=");
    expect(window.location.pathname).not.toMatch(/\/materials\//);

    // No "All" chip — re-click active color clears the color filter.
    expect(container.querySelector('[data-testid="jw-palette-all"]')).toBeNull();
    click(container.querySelector('[data-testid="jw-palette-green"]'));
    expect(window.location.search).not.toContain("aesthetic=");
    expect(window.location.search).not.toContain("color=");

    click(container.querySelector('[data-testid="jw-mood-rail-toggle"]'));
    click(container.querySelector('[data-testid="jw-mood-warm-earthy"]'));
    expect(window.location.search).toContain("aesthetic=warm-earthy");
    expect(window.location.search).not.toContain("color=");

    // Mood is independent from literal color; selecting a color clears aesthetic.
    click(container.querySelector('[data-testid="jw-palette-beige"]'));
    expect(window.location.search).toContain("color=beige");
    expect(window.location.search).not.toContain("aesthetic=");

    click(container.querySelector('[data-testid="jw-material-rail-toggle"]'));
    click(container.querySelector('[data-testid="jw-material-quartzite"]'));
    // Material browse clears color/aesthetic — material-first, no color gate.
    expect(window.location.pathname).toContain("/materials/quartzite");
    expect(window.location.search).not.toContain("aesthetic=");
    expect(window.location.search).not.toContain("color=");
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("false");
  });

  it("clears browse refinements when Full inventory opens", () => {
    click(container.querySelector('[data-testid="jw-palette-rail-toggle"]'));
    click(container.querySelector('[data-testid="jw-palette-green"]'));
    expect(window.location.search).toContain("color=green");

    click(container.querySelector('[data-testid="jw-inventory-toggle"]'));
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("true");
    expect(window.location.pathname).not.toMatch(/\/materials\//);
    expect(window.location.search).not.toContain("color=");
    expect(window.location.search).not.toContain("aesthetic=");
    expect(container.querySelector('[aria-label="Active filters"]')).toBeNull();
    expect(container.textContent).toMatch(/selections in the collection/);
    expect(container.textContent).not.toMatch(/matching refinements/);
  });

  it("does not invent a material tag from Browse by color alone", () => {
    click(container.querySelector('[data-testid="jw-material-rail-toggle"]'));
    click(container.querySelector('[data-testid="jw-material-marble"]'));
    expect(window.location.pathname).toContain("/materials/marble");

    click(container.querySelector('[data-testid="jw-palette-rail-toggle"]'));
    click(container.querySelector('[data-testid="jw-palette-green"]'));
    expect(window.location.search).toContain("color=green");
    expect(window.location.pathname).not.toMatch(/\/materials\//);
    expect(window.location.search).not.toContain("aesthetic=");
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[aria-label="Active filters"]')).toBeNull();
  });

  it("shows matching stones immediately after Browse by color selection", () => {
    click(container.querySelector('[data-testid="jw-palette-rail-toggle"]'));
    expect(container.querySelector('[data-testid="jw-palette-results"]')).toBeNull();

    click(container.querySelector('[data-testid="jw-palette-green"]'));
    expect(window.location.search).toContain("color=green");
    expect(window.location.pathname).not.toMatch(/\/materials\//);
    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("true");
    expect(container.querySelector('[data-testid="jw-palette-results"]')).not.toBeNull();
    expect(
      container.querySelectorAll('[data-testid="jw-palette-results"] [data-stone-card]').length
    ).toBeGreaterThan(0);
    expect(
      container.querySelector('[data-testid="jw-material-stone-status"]')?.textContent
    ).toMatch(/^Green · \d+ of \d+$/);
    expect(container.textContent).not.toMatch(/\d+ green selections/i);
    // Color browse must not require opening Full inventory.
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("false");
  });

  it("starts with inventory, color, mood, and material collapsed on canonical /u/jw-stone", () => {
    expect(window.location.pathname).toBe("/u/jw-stone");
    expect(window.location.pathname).not.toMatch(/\/materials\//);
    expect(window.location.search).not.toContain("color=");
    expect(window.location.search).not.toContain("aesthetic=");
    expect(window.location.search).not.toContain("material=");
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(
      container.querySelector('[data-testid="jw-material-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(
      container.querySelector('[data-testid="jw-mood-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-palette-results"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-mood-results"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-palette-chip-row"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-stack"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-stone-rail"]')).toBeNull();
    expect(container.querySelector('[data-testid^="jw-material-section-"]')).toBeNull();
  });

  it("keeps Browse by material collapsed on material deep-link until the shopper opens it", () => {
    act(() => root.unmount());
    window.history.replaceState(null, "", "/jw-stone/materials/granite");
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));

    expect(window.location.pathname).toContain("/materials/granite");
    expect(
      container.querySelector('[data-testid="jw-material-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-material-stack"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-stone-rail"]')).toBeNull();
    // Color must not regress to auto-open either.
    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");

    click(container.querySelector('[data-testid="jw-material-rail-toggle"]'));
    expect(
      container.querySelector('[data-testid="jw-material-rail"]')?.getAttribute("data-expanded")
    ).toBe("true");
    expect(
      container
        .querySelector('[data-testid="jw-material-section-granite"]')
        ?.getAttribute("data-expanded")
    ).toBe("true");
    expect(container.querySelector('[data-testid="jw-material-stone-rail"]')).not.toBeNull();
  });

  it("does not open Browse by color or write color params when a material is selected", () => {
    click(container.querySelector('[data-testid="jw-material-rail-toggle"]'));
    click(container.querySelector('[data-testid="jw-material-granite"]'));
    expect(window.location.pathname).toContain("/materials/granite");
    expect(window.location.search).not.toContain("color=");
    expect(window.location.search).not.toContain("aesthetic=");
    expect(container.querySelector('[data-testid="jw-material-color-refine-granite"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="jw-material-stone-rail-granite"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-palette-results"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-palette-chip-row"]')).toBeNull();
  });

  it("keeps Browse by color collapsed on color deep-link until the shopper opens it", () => {
    act(() => root.unmount());
    window.history.replaceState(null, "", "/jw-stone?color=green");
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));

    expect(window.location.search).toContain("color=green");
    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-palette-results"]')).toBeNull();

    click(container.querySelector('[data-testid="jw-palette-rail-toggle"]'));
    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("true");
    expect(container.querySelector('[data-testid="jw-palette-results"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="jw-palette-green"]')?.getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("keeps Browse by mood collapsed on aesthetic deep-link until the shopper opens it", () => {
    act(() => root.unmount());
    window.history.replaceState(null, "", "/jw-stone?aesthetic=warm-earthy");
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));

    expect(window.location.search).toContain("aesthetic=warm-earthy");
    expect(
      container.querySelector('[data-testid="jw-mood-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-mood-results"]')).toBeNull();

    click(container.querySelector('[data-testid="jw-mood-rail-toggle"]'));
    expect(container.querySelector('[data-testid="jw-mood-results"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="jw-mood-warm-earthy"]')?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(window.location.search).not.toContain("color=");
  });

  it("lists Onyx and opens its stones without a color gate", () => {
    click(container.querySelector('[data-testid="jw-material-rail-toggle"]'));
    expect(container.querySelector('[data-testid="jw-material-onyx"]')).not.toBeNull();
    expect(container.textContent).toMatch(/Onyx/);

    click(container.querySelector('[data-testid="jw-material-onyx"]'));
    expect(window.location.pathname).toContain("/materials/onyx");
    expect(window.location.search).not.toContain("color=");
    expect(window.location.search).not.toContain("aesthetic=");
    expect(container.querySelector('[data-testid="jw-material-color-refine-onyx"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-material-stone-rail-onyx"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="jw-palette-rail"]')?.getAttribute("data-expanded")
    ).toBe("false");
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

    click(container.querySelector('[data-testid="jw-inventory-toggle"]'));
    click(container.querySelector<HTMLButtonElement>('button[aria-label^="Save "]'));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();
  });

  it("orders header, hero, First Cut, inventory, color, mood, material, story, footer, then Connect", () => {
    const header = container.querySelector('[data-testid="jw-marketplace-header"]');
    const hero = container.querySelector('[data-testid="jw-marketplace-hero"]');
    const firstCut = container.querySelector("#first-cut-title")?.closest("section");
    const palette = container.querySelector('[data-testid="jw-palette-rail"]');
    const mood = container.querySelector('[data-testid="jw-mood-rail"]');
    const materials = container.querySelector('[data-testid="jw-material-rail"]');
    const inventory = container.querySelector("#current-inventory");
    const story = container.querySelector('[data-testid="jw-marketplace-story"]');
    const footer = container.querySelector('[data-testid="jw-marketplace-footer"]');
    const request = container.querySelector('[data-testid="jw-marketplace-request"]');

    expect(header).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(firstCut).not.toBeNull();
    expect(palette).not.toBeNull();
    expect(mood).not.toBeNull();
    expect(materials).not.toBeNull();
    expect(inventory).not.toBeNull();
    expect(story).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-marketplace-trust"]')).toBeNull();
    expect(footer).not.toBeNull();
    expect(request).not.toBeNull();
    expect(container.querySelector('[data-testid="jw-finished-work-bridge"]')).toBeNull();
    if (
      !header ||
      !hero ||
      !firstCut ||
      !palette ||
      !mood ||
      !materials ||
      !inventory ||
      !story ||
      !footer ||
      !request
    ) {
      throw new Error("Expected page sections");
    }

    expect(header.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hero.compareDocumentPosition(firstCut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      firstCut.compareDocumentPosition(inventory) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      inventory.compareDocumentPosition(palette) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(palette.compareDocumentPosition(mood) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mood.compareDocumentPosition(materials) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      materials.compareDocumentPosition(story) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(story.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(footer.compareDocumentPosition(request) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(inventory.className).toMatch(/scroll-mt-/);

    const rail = firstCut.querySelector('[data-testid="jw-first-cut-rail"]');
    expect(rail?.className).toMatch(/jw-first-cut__premiere/);
    expect(rail?.className).toMatch(/grid-cols-1/);
    expect(rail?.className).not.toMatch(/snap-x|overflow-x-auto|grid-cols-3|lg:grid-cols-/);
    expect(firstCut.className).toMatch(/jw-first-cut/);
    expect(firstCut.querySelector(".jw-first-cut__lead")).not.toBeNull();
    const supportRow = firstCut.querySelector(".jw-first-cut__support");
    expect(supportRow).not.toBeNull();
    expect(supportRow?.className).toMatch(/grid-cols-2/);
    expect(supportRow?.className).not.toMatch(/lg:grid-cols-1|min-h-\[56svh\]|lg:min-h-/);
    const photoSlots = firstCut.querySelectorAll('[data-first-cut-photo="true"]');
    expect(photoSlots.length).toBe(3);
    expect(firstCut.querySelectorAll('[data-first-cut-lead="true"]')).toHaveLength(1);
    expect(firstCut.querySelectorAll('[data-first-cut-support="true"]')).toHaveLength(2);
    for (const slot of Array.from(photoSlots)) {
      const img = slot.querySelector("img");
      expect(img).not.toBeNull();
      expect(img?.getAttribute("src")).toMatch(/\/first-cut\/0[125]\.jpg/);
      expect(slot.className).not.toMatch(/w-\[88vw\]|w-\[86vw\]|shrink-0/);
      expect(slot.className).not.toMatch(/--jw-dark|jw-dark/);
      expect(img?.className).not.toMatch(/max-h-|absolute|inset-0/);
      expect(img?.getAttribute("alt")).toBe("");
      expect(img?.getAttribute("title")).toBeNull();
      expect(slot.getAttribute("title")).toBeNull();
      expect(slot.getAttribute("aria-label")).toBeTruthy();
      expect(slot.getAttribute("aria-label")).not.toMatch(/photograph/i);
      expect(slot.textContent?.trim()).toBe("");
      expect(slot.textContent).not.toMatch(/\bOpen\b/i);
    }
    const lead = firstCut.querySelector('[data-first-cut-lead="true"]');
    const leadFrame = lead?.querySelector("span");
    const leadImg = lead?.querySelector("img");
    // Aspect frame + cover on whole long-slab lead — no oversized svh bands / beige voids.
    expect(leadFrame?.className).toMatch(/aspect-/);
    expect(leadFrame?.className).not.toMatch(/svh|min-h-0|min-h-\[/);
    expect(leadImg?.className).toMatch(/object-cover/);
    expect(leadImg?.className).not.toMatch(/object-contain/);
    const supportTiles = firstCut.querySelectorAll('[data-first-cut-support="true"]');
    const supportFrames = Array.from(supportTiles).map((tile) => tile.querySelector("span"));
    expect(supportFrames).toHaveLength(2);
    for (const frame of supportFrames) {
      expect(frame?.className).toMatch(/aspect-\[4\/3\]/);
      expect(frame?.className).not.toMatch(/svh|min-h-\[/);
    }
    // Equal grid cells: both support frames share the same aspect utility (identical box size).
    expect(supportFrames[0]?.className).toBe(supportFrames[1]?.className);
    const supportImgs = firstCut.querySelectorAll('[data-first-cut-support="true"] img');
    expect(supportImgs.length).toBe(2);
    for (const img of Array.from(supportImgs)) {
      expect(img.className).toMatch(/object-cover/);
      expect(img.className).not.toMatch(/object-contain/);
    }
    // Lead is the physically long green bookmatched pair (05), not burgundy (02) or black vein (01).
    expect(leadImg?.getAttribute("src")).toContain("/first-cut/05.jpg");
    expect(leadImg?.getAttribute("src")).toContain("v=green-bookmatch-lead-1");
    expect(leadFrame?.className).toMatch(/aspect-\[2\/1\]/);
    const supportSrcs = Array.from(supportImgs).map((img) => img.getAttribute("src") ?? "");
    expect(supportSrcs.some((src) => src.includes("/first-cut/01.jpg"))).toBe(true);
    expect(supportSrcs.some((src) => src.includes("/first-cut/02.jpg"))).toBe(true);
    const firstCutTitle = firstCut.querySelector("#first-cut-title");
    expect(firstCutTitle?.textContent).toBe("First Cut Exclusives");
    expect(firstCutTitle?.className).toMatch(/font-editorial/);
    expect(firstCutTitle?.className).not.toMatch(/font-serif/);
    expect(firstCut.textContent).not.toContain("New to market. First chance to buy.");
    expect(firstCut.textContent).not.toContain(
      "Thirty years of expertise for fabricators, architects, designers, builders, and homeowners."
    );
    expect(firstCut.textContent).not.toMatch(/newly sourced/i);
    expect(firstCut.textContent).not.toMatch(/Fresh from the first cut/i);
    expect(firstCut.textContent).not.toMatch(/Details pending/i);
    expect(firstCut.textContent).not.toMatch(/Entering the market for the first time/i);
    expect(firstCut.className).not.toMatch(/darkBar|jw-dark|--jw-dark/);
  });

  it("opens First Cut photo tiles into stone detail with Ask and Share", () => {
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    click(container.querySelector('[data-testid="jw-first-cut-photo-first-cut-1"]'));
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain("First Cut");
    expect(dialog?.querySelector("img")?.getAttribute("src")).toContain("/first-cut/05.jpg");
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-actions"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-ask"]')?.textContent).toContain(
      "Ask JW about this First Cut"
    );
    expect(dialog?.querySelector('[data-testid="jw-stone-share"]')).not.toBeNull();
    expect(dialog?.querySelector('[data-testid="jw-stone-detail-save"]')).toBeNull();

    click(dialog?.querySelector('[data-testid="jw-stone-detail-ask"]') ?? null);
    expect(container.querySelector('[data-testid="direct-connect-panel"]')?.textContent).toContain(
      "General request"
    );
  });

  it("keeps Full inventory collapsed after a color swatch; expand is a clean slate", () => {
    click(container.querySelector('[data-testid="jw-palette-rail-toggle"]'));
    click(container.querySelector('[data-testid="jw-palette-green"]'));
    expect(window.location.search).toContain("color=green");
    expect(window.location.pathname).not.toMatch(/\/materials\//);
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-inventory-grid"]')).toBeNull();
    expect(container.querySelector('[data-testid="jw-palette-results"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="jw-palette-rail-toggle"]')?.getAttribute("aria-label")
    ).toBe("Close Browse by color");
    expect(
      container.querySelector('[data-testid="jw-material-rail-toggle"]')?.getAttribute("aria-label")
    ).toBe("Open Browse by material");
    expect(
      container.querySelector('[data-testid="jw-inventory-toggle"]')?.getAttribute("aria-label")
    ).toBe("Open Full inventory");
    expect(
      container.querySelector('[data-testid="jw-palette-rail-expand-cue"]')?.textContent
    ).toMatch(/^Close$/);
    expect(
      container.querySelector('[data-testid="jw-material-rail-expand-cue"]')?.textContent
    ).toMatch(/^Open$/);
    expect(container.querySelector('[data-testid="jw-inventory-expand-cue"]')?.textContent).toMatch(
      /^Open$/
    );
    expect(container.querySelector('[data-testid="jw-inventory-expand-chevron"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/Tap to open/i);

    const inventoryToggle = container.querySelector('[data-testid="jw-inventory-toggle"]');
    click(inventoryToggle);
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("true");
    expect(window.location.search).not.toContain("color=");
    expect(window.location.pathname).not.toMatch(/\/materials\//);
    expect(container.querySelector('[aria-label="Active filters"]')).toBeNull();
    expect(container.querySelectorAll("#current-inventory [data-stone-card]")).toHaveLength(8);
    // Expanded inventory keeps a sticky photo title band so header toggle stays reachable.
    expect(inventoryToggle?.className).toMatch(/\bsticky\b/);
    expect(inventoryToggle?.className).toMatch(/top-14/);
    expect(inventoryToggle?.getAttribute("aria-label")).toBe("Close Full inventory");

    click(inventoryToggle);
    expect(
      container.querySelector('[data-testid="jw-inventory"]')?.getAttribute("data-expanded")
    ).toBe("false");
    expect(container.querySelector('[data-testid="jw-inventory-grid"]')).toBeNull();
    expect(inventoryToggle?.className).toMatch(/min-h-\[25svh\]/);
    expect(inventoryToggle?.className).not.toMatch(/\bsticky\b/);
  });
});
