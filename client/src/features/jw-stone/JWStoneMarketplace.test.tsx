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

  it("locks the approved JW Stone header, hero, footer, and profile-owned wording", () => {
    expect(container.querySelector('a[aria-label="JW Stone marketplace home"]')).not.toBeNull();
    expect(buttonContaining(container, "Start a Request")).not.toBeNull();
    expect(container.textContent).toContain("JW Stone · A new way to discover stone");
    expect(container.textContent).toContain("Natural stone, selected at the source.");
    expect(container.textContent).toContain("Begin your selection");
    expect(container.textContent).toContain(
      "Stone discovery on your terms. Saving never starts a request."
    );
    expect(container.textContent).toContain("Fabricators");
    expect(container.textContent).toContain("Builders & Developers");
    expect(container.textContent).toContain("Architects & Designers");
    expect(container.textContent).toContain("Homeowners");
    expect(container.textContent).not.toContain("Stone chosen around the way you see a project");
    expect(container.textContent).not.toContain("Begin with your point of view");

    const hero = container.querySelector<HTMLElement>('[data-testid="buyer-selection"]');
    const heroImage = hero?.querySelector<HTMLImageElement>(
      'img[src="/images/businesses/jw-stone/video/hero-poster.jpg"]'
    );
    const heroVeil = hero?.querySelector<HTMLElement>("div.absolute.inset-0.-z-10");
    expect(heroImage?.className).toBe("absolute inset-0 -z-20 h-full w-full object-cover");
    expect(heroVeil?.className).toContain("from-black/55");
    expect(heroVeil?.className).toContain("via-black/15");
    expect(heroVeil?.className).toContain("to-transparent");
    expect(heroVeil?.className).not.toContain("via-black/70");
  });

  it("requires buyer and then color before any inventory renders", () => {
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(0);
    expect(container.querySelector('[data-testid="buyer-selection"]')).not.toBeNull();

    click(buttonContaining(container, "Fabricators"));
    expect(container.querySelector('[data-testid="color-selection"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(0);

    click(buttonContaining(container, "Soft & Light"));
    expect(container.querySelector('[data-testid="fabricator-workspace"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-stone-card]")).toHaveLength(12);
    expect(container.textContent).toContain("Show more stones");
    expect(
      container.querySelector('select[aria-label="Filter by verified country of origin"]')
    ).toBeNull();
  });

  it("renders four materially different buyer workspaces", () => {
    const journeys = [
      ["Fabricators", "fabricator-workspace", "Source bundle counts are shown"],
      ["Builders & Developers", "builder-workspace", "Project selection"],
      ["Architects & Designers", "designer-workspace", "Visual edit"],
      ["Homeowners", "homeowner-workspace", "shortlist"],
    ] as const;

    for (const [buyer, testId, distinctiveCopy] of journeys) {
      click(buttonContaining(container, buyer));
      click(buttonContaining(container, "Soft & Light"));
      expect(container.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
      expect(container.textContent).toContain(distinctiveCopy);
      click(buttonContaining(container, buyer));
    }
  });

  it("keeps anonymous inventory nameless and outside save controls and public state", () => {
    click(buttonContaining(container, "Homeowners"));
    click(buttonContaining(container, "Bold & Expressive"));

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
    expect(dialog?.textContent).not.toContain("Ask JW Stone about availability");
    expect(buttonContaining(dialog!, "Ask about this stone")).toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();
  });

  it("persists a named wishlist without opening contact", () => {
    click(buttonContaining(container, "Architects & Designers"));
    click(buttonContaining(container, "Soft & Light"));

    const saveButton = container.querySelector<HTMLButtonElement>('button[aria-label^="Save "]');
    click(saveButton);

    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="direct-connect-panel"]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    act(() => root.render(<JWStoneMarketplace />));
    expect(container.querySelector('[aria-label="Open saved stones, 1 saved"]')).not.toBeNull();

    click(buttonContaining(container, "Review a specification"));
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

  it("places the intact First Cut rail directly between the hero and buyer choices", () => {
    const hero = container.querySelector('[data-testid="buyer-selection"]');
    const firstCut = container.querySelector("#first-cut-title")?.closest("section");
    const buyerChoices = container.querySelector("#choose-buyer");

    expect(hero).not.toBeNull();
    expect(firstCut).not.toBeNull();
    expect(buyerChoices).not.toBeNull();
    if (!hero || !firstCut || !buyerChoices) throw new Error("Expected all three page sections");

    expect(hero.compareDocumentPosition(firstCut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      firstCut.compareDocumentPosition(buyerChoices) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("keeps every visible dropdown labeled and dark on a light background", () => {
    click(buttonContaining(container, "Fabricators"));
    click(buttonContaining(container, "Soft & Light"));

    const selects = Array.from(container.querySelectorAll<HTMLSelectElement>("select"));
    expect(selects).toHaveLength(2);
    for (const select of selects) {
      expect(select.classList.contains("text-stone-950")).toBe(true);
      expect(select.classList.contains("bg-stone-50")).toBe(true);
      expect(select.classList.contains("[color-scheme:light]")).toBe(true);
      expect(Array.from(select.options).every((option) => option.textContent?.trim())).toBe(true);
    }

    const finish = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Filter by finish"]'
    );
    expect(finish).not.toBeNull();
    expect(
      Array.from(finish!.options).some((option) =>
        /^Polished \(\d+\)$/.test(option.textContent ?? "")
      )
    ).toBe(true);
    act(() => {
      finish!.value = "polished";
      finish!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(window.location.search).toContain("finish=polished");
    for (const card of container.querySelectorAll<HTMLElement>("[data-stone-card]")) {
      expect(card.textContent).toContain("Polished");
    }
    expect(container.innerHTML).not.toMatch(/Dual Finish/i);
  });

  it("keeps the mobile color step in a horizontal rail instead of a page-length stack", () => {
    click(buttonContaining(container, "Homeowners"));
    const rail = container.querySelector<HTMLElement>('[aria-label="Color directions"]');
    expect(rail?.className).toContain("overflow-x-auto");
    expect(rail?.className).toContain("snap-mandatory");
    const choices = Array.from(rail?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    expect(choices).toHaveLength(5);
    expect(choices.every((choice) => choice.className.includes("w-[82vw]"))).toBe(true);
  });
});
