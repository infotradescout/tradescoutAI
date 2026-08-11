// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_START_REQUEST_PATH,
} from "@shared/steelHomePackagesProfile";
import SteelHomePackagesProfile from "./SteelHomePackagesProfile";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("./TradeScoutProfileHandoff", () => ({
  default: () => <footer data-testid="tradescout-handoff">Powered by TradeScout</footer>,
}));

describe("SteelHomePackagesProfile", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderProfile() {
    act(() => {
      root.render(
        <SteelHomePackagesProfile
          requestHref={STEEL_HOME_PACKAGES_START_REQUEST_PATH}
          laborRequestHref={STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH}
        />
      );
    });
  }

  it("presents TradeScout as the single customer-facing package contact", () => {
    renderProfile();

    const text = container.textContent || "";
    expect(text).toContain(content.hero.headline);
    expect(text).toContain(content.hero.body);
    expect(text).toContain("Metal structure");
    expect(text).toContain("Natural stone");
    expect(text).toContain("Cabinets");
    expect(text).toContain("one clear package with one point of contact");
    expect(text).toContain("one coordinated package quote and one place to call");
    expect(text).toContain("You work with TradeScout");
    expect(text).toContain(content.labor.body);
    expect(text).toContain(content.disclosure);

    const profile = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-packages-profile"]'
    );
    expect(profile?.className).toContain("pt-[72px]");
    expect(profile?.querySelector("header")?.className).toContain("fixed");

    const packageCards = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid^="steel-home-package-"]')
    );
    expect(packageCards.map((card) => card.dataset.testid)).toEqual([
      "steel-home-package-structure",
      "steel-home-package-stone",
      "steel-home-package-cabinets",
    ]);

    for (const privateRelationshipCopy of [
      "Worldwide Steel Buildings",
      "JW Stone Logistics",
      "A+ Cabinets",
      "Ocean Springs",
      "partner",
      "supplier",
      "affiliate",
      "referral",
    ]) {
      expect(text.toLowerCase()).not.toContain(privateRelationshipCopy.toLowerCase());
    }

    for (const futureCategory of [
      "single-wide",
      "tiny home",
      "mini-split",
      "tankless",
      "appliance package",
      "whole-home warranty",
      "plumbing package",
      "electrical package",
      "drywall",
      "HomeID",
    ]) {
      expect(text.toLowerCase()).not.toContain(futureCategory.toLowerCase());
    }

    const orderedSectionIds = [
      "steel-home-hero",
      "steel-home-starting",
      "steel-home-home-ideas",
      "steel-home-package",
      "steel-home-process",
      "steel-home-labor",
      "steel-home-final-action",
      "steel-home-disclosure",
    ];
    const sections = orderedSectionIds.map((testId) =>
      container.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
    );
    expect(sections.every(Boolean)).toBe(true);
    for (let index = 0; index < sections.length - 1; index += 1) {
      const position = sections[index]?.compareDocumentPosition(sections[index + 1] as Node) || 0;
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });

  it("builds useful package and labor handoffs without sending visitors to outside companies", () => {
    renderProfile();

    expect(
      container.querySelector('[data-testid="steel-home-builder-package-continue"]')
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="steel-home-builder-package-continue-disabled"]')
    ).not.toBeNull();

    const location = container.querySelector<HTMLInputElement>(
      '[data-testid="steel-home-builder-location"]'
    );
    const setInputValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    act(() => {
      setInputValue?.call(location, "Hammond, LA 70401");
      location?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const structureToggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-builder-toggle-structure"]'
    );
    act(() => structureToggle?.click());

    const packageContinue = container.querySelector<HTMLAnchorElement>(
      '[data-testid="steel-home-builder-package-continue"]'
    );
    expect(packageContinue).not.toBeNull();
    const packageUrl = new URL(
      packageContinue?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    );
    expect(packageUrl.pathname).toBe("/direct-connect");
    expect(packageUrl.searchParams.get("subject")).toBe("product");
    expect(packageUrl.searchParams.has("intent")).toBe(false);
    expect(packageUrl.searchParams.get("location")).toBe("Hammond, LA 70401");
    expect(packageUrl.searchParams.get("description")).toContain("Metal structure");

    const stoneToggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-builder-toggle-stone"]'
    );
    act(() => stoneToggle?.click());
    const cristallo = container.querySelector<HTMLButtonElement>(
      '[data-testid="steel-home-stone-cristallo"]'
    );
    expect(cristallo).not.toBeNull();
    act(() => cristallo?.click());
    const updatedPackageUrl = new URL(
      container
        .querySelector<HTMLAnchorElement>('[data-testid="steel-home-builder-package-continue"]')
        ?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    );
    expect(updatedPackageUrl.searchParams.get("description")).toContain("Cristallo");

    const laborTrade = Array.from(
      container.querySelectorAll<HTMLButtonElement>('#steel-home-labor-builder button')
    ).find((button) => button.textContent?.includes("Steel erection"));
    act(() => laborTrade?.click());
    const laborContinue = container.querySelector<HTMLAnchorElement>(
      '[data-testid="steel-home-builder-labor-continue"]'
    );
    expect(laborContinue).not.toBeNull();
    const laborUrl = new URL(
      laborContinue?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    );
    expect(laborUrl.searchParams.get("subject")).toBe("service");
    expect(laborUrl.searchParams.has("profile")).toBe(false);
    expect(laborUrl.searchParams.get("location")).toBe("Hammond, LA 70401");
    expect(laborUrl.searchParams.get("description")).toContain("Steel erection");

    const ideaButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("Browse home ideas")
    );
    expect(ideaButton).toBeDefined();
    const homeIdeasSection = container.querySelector<HTMLElement>("#home-ideas");
    expect(homeIdeasSection).not.toBeNull();
    const scrollIntoView = vi.fn();
    if (homeIdeasSection) homeIdeasSection.scrollIntoView = scrollIntoView;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    act(() => ideaButton?.click());
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });

    const allLinkHrefs = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]")).map(
      (link) => link.getAttribute("href") || ""
    );
    expect(allLinkHrefs.filter((href) => href.startsWith("#"))).toEqual([]);
    const outsideLinks = allLinkHrefs.filter((href) => /^https?:\/\//i.test(href));
    expect(outsideLinks).toEqual([]);

    const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
    expect(images.length).toBeGreaterThan(7);
    expect(images.every((image) => Boolean(image.getAttribute("alt")?.trim()))).toBe(true);
    expect(images.map((image) => image.getAttribute("src"))).toEqual(
      expect.arrayContaining([
        "/images/businesses/steel-home-packages/steel-home-hero.webp",
        "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
        "/images/businesses/jw-stone/story/taj-living-room.webp",
        "/images/businesses/jw-stone/inventory/quartzite/cristallo/1.webp",
      ])
    );

    const text = container.textContent || "";
    for (const unsupportedClaim of [
      "starting at",
      "monthly payment",
      "nationwide delivery",
      "five-star",
      "exclusive",
      "guaranteed approval",
      "licensed and insured",
      "AI-generated",
    ]) {
      expect(text.toLowerCase()).not.toContain(unsupportedClaim.toLowerCase());
    }
    expect(text).not.toMatch(/\$\s?\d/);
  });
});
