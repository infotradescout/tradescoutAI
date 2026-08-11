// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JW_STONE_MARKETPLACE_PATH,
  STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH,
  STEEL_HOME_PACKAGES_PROFILE_CONTENT as content,
  STEEL_HOME_PACKAGES_START_REQUEST_PATH,
  WORLDWIDE_STEEL_BUILDINGS_3D_DESIGNER_URL,
  WORLDWIDE_STEEL_BUILDINGS_RESIDENTIAL_GALLERY_URL,
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
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderProfile(platformBaseHref = "") {
    act(() => {
      root.render(
        <SteelHomePackagesProfile
          requestHref={STEEL_HOME_PACKAGES_START_REQUEST_PATH}
          laborRequestHref={STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH}
          platformBaseHref={platformBaseHref}
        />
      );
    });
  }

  it("renders a premium three-TradePartner showcase without a homebuilder claim", () => {
    renderProfile();

    const text = container.textContent || "";
    expect(text).toContain(content.hero.headline);
    expect(text).toContain("Worldwide Steel Buildings");
    expect(text).toContain("JW Stone Logistics");
    expect(text).toContain("A+ Cabinets");
    expect(text).toContain("Ocean Springs, Mississippi");
    expect(text).toContain("Three companies. Three clear scopes.");
    expect(text).toContain(content.labor.body);
    expect(text).toContain(content.disclosure);

    const profile = container.querySelector<HTMLElement>(
      '[data-testid="steel-home-packages-profile"]'
    );
    expect(profile?.className).toContain("pt-[72px]");
    expect(profile?.querySelector("header")?.className).toContain("fixed");

    expect(
      Array.from(
        container.querySelectorAll<HTMLElement>('[data-testid^="steel-home-tradepartner-"]')
      ).map((card) => card.dataset.testid)
    ).toEqual([
      "steel-home-tradepartner-worldwide-steel-buildings",
      "steel-home-tradepartner-jw-stone-logistics",
      "steel-home-tradepartner-a-plus-cabinets",
    ]);

    for (const falseProductCopy of [
      "Steel Home Studio",
      "A steel home, built around your life",
      "Build your package",
      "Start your package",
      "one clear package",
      "one coordinated package",
      "one package quote",
      "complete home package",
      "turnkey home",
      "monthly payment",
    ]) {
      expect(text.toLowerCase()).not.toContain(falseProductCopy.toLowerCase());
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
      "HomeID",
    ]) {
      expect(text.toLowerCase()).not.toContain(futureCategory.toLowerCase());
    }

    const orderedSectionIds = [
      "steel-home-hero",
      "steel-home-partners",
      "steel-home-worldwide",
      "steel-home-jw-stone",
      "steel-home-a-plus",
      "steel-home-integration",
      "steel-home-labor",
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

  it("connects each named partner to a real tool, collection, or partner-specific request", () => {
    renderProfile();

    const worldwideRequest = container.querySelector<HTMLAnchorElement>(
      '[data-testid="steel-home-worldwide-request"]'
    );
    const worldwideRequestUrl = new URL(
      worldwideRequest?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    );
    expect(worldwideRequestUrl.pathname).toBe("/direct-connect");
    expect(worldwideRequestUrl.searchParams.get("profile")).toBe("steel-home-packages");
    expect(worldwideRequestUrl.searchParams.get("subject")).toBe("product");
    expect(worldwideRequestUrl.searchParams.get("source")).toBe(
      "steel_home_tradepartners_worldwide"
    );
    expect(worldwideRequestUrl.searchParams.get("title")).toBe(
      "Worldwide Steel Buildings structure request"
    );
    expect(worldwideRequestUrl.searchParams.get("description")).toContain(
      "TradePartner: Worldwide Steel Buildings"
    );

    const worldwideDesigner = container.querySelector<HTMLAnchorElement>(
      '[data-testid="steel-home-worldwide-designer"]'
    );
    expect(worldwideDesigner?.href).toBe(WORLDWIDE_STEEL_BUILDINGS_3D_DESIGNER_URL);
    expect(worldwideDesigner?.target).toBe("_blank");
    expect(worldwideDesigner?.rel).toContain("noopener");

    const worldwideGallery = container.querySelector<HTMLAnchorElement>(
      '[data-testid="steel-home-worldwide-gallery"]'
    );
    expect(worldwideGallery?.href).toBe(WORLDWIDE_STEEL_BUILDINGS_RESIDENTIAL_GALLERY_URL);

    const collection = container.querySelector<HTMLAnchorElement>(
      '[data-testid="steel-home-jw-stone-collection"]'
    );
    expect(collection?.getAttribute("href")).toBe(JW_STONE_MARKETPLACE_PATH);

    for (const stoneId of content.tradePartners.jwStone.featuredStoneIds) {
      const stoneLink = container.querySelector<HTMLAnchorElement>(
        `[data-testid="steel-home-jw-stone-${stoneId}"]`
      );
      expect(stoneLink?.getAttribute("href")).toBe(`/jw-stone/stones/${stoneId}`);
    }

    const jwRequestUrl = new URL(
      container
        .querySelector<HTMLAnchorElement>('[data-testid="steel-home-jw-stone-request"]')
        ?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    );
    expect(jwRequestUrl.searchParams.get("profile")).toBe("steel-home-packages");
    expect(jwRequestUrl.searchParams.get("source")).toBe("steel_home_tradepartners_jw_stone");
    expect(jwRequestUrl.searchParams.get("description")).toContain(
      "TradePartner: JW Stone Logistics"
    );

    const aPlusRequestUrl = new URL(
      container
        .querySelector<HTMLAnchorElement>('[data-testid="steel-home-a-plus-request"]')
        ?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    );
    expect(aPlusRequestUrl.searchParams.get("profile")).toBe("steel-home-packages");
    expect(aPlusRequestUrl.searchParams.get("source")).toBe(
      "steel_home_tradepartners_a_plus_cabinets"
    );
    expect(aPlusRequestUrl.searchParams.get("description")).toContain(
      "TradePartner: A+ Cabinets — Ocean Springs, Mississippi"
    );

    const laborUrl = new URL(
      container
        .querySelector<HTMLAnchorElement>('[data-testid="steel-home-labor-request"]')
        ?.getAttribute("href") || "",
      "https://www.thetradescout.com"
    );
    expect(laborUrl.searchParams.get("subject")).toBe("service");
    expect(laborUrl.searchParams.has("profile")).toBe(false);
    expect(laborUrl.searchParams.has("target")).toBe(false);

    const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
    expect(images.length).toBeGreaterThanOrEqual(11);
    expect(images.every((image) => Boolean(image.getAttribute("alt")?.trim()))).toBe(true);
    expect(images.map((image) => image.getAttribute("src"))).toEqual(
      expect.arrayContaining([
        "/images/businesses/steel-home-packages/steel-home-hero.webp",
        "/images/businesses/steel-home-packages/cabinet-kitchen.webp",
        "/images/businesses/jw-stone/inventory/quartzite/cristallo/1.webp",
      ])
    );

    const text = container.textContent || "";
    expect(text).not.toMatch(/\$\s?\d/);
  });

  it("keeps in-page controls on the profile and qualifies TradeScout links when needed", () => {
    renderProfile("https://www.thetradescout.com");

    const worldwideSection = container.querySelector<HTMLElement>("#worldwide-steel");
    expect(worldwideSection).not.toBeNull();
    const scrollIntoView = vi.fn();
    if (worldwideSection) worldwideSection.scrollIntoView = scrollIntoView;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="steel-home-hero-partner-structure"]')
        ?.click();
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });

    expect(
      container
        .querySelector<HTMLAnchorElement>('[data-testid="steel-home-jw-stone-collection"]')
        ?.getAttribute("href")
    ).toBe("https://www.thetradescout.com/jw-stone");
    expect(
      container
        .querySelector<HTMLAnchorElement>('[data-testid="steel-home-jw-stone-cristallo"]')
        ?.getAttribute("href")
    ).toBe("https://www.thetradescout.com/jw-stone/stones/cristallo");

    const hashLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
    expect(hashLinks).toHaveLength(0);
  });
});
