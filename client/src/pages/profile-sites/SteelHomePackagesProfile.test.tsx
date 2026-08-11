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

  it("keeps package and labor requests separate without sending visitors to outside companies", () => {
    renderProfile();

    const packageRequestLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-testid="steel-home-start-request"]')
    );
    expect(packageRequestLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of packageRequestLinks) {
      expect(link.getAttribute("href")).toBe(STEEL_HOME_PACKAGES_START_REQUEST_PATH);
    }

    const laborRequestLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-testid="steel-home-labor-request"]')
    );
    expect(laborRequestLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of laborRequestLinks) {
      expect(link.getAttribute("href")).toBe(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH);
    }

    expect(container.querySelector<HTMLAnchorElement>('a[href="#home-ideas"]')).not.toBeNull();
    const outsideLinks = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((link) => link.getAttribute("href") || "")
      .filter((href) => /^https?:\/\//i.test(href));
    expect(outsideLinks).toEqual([]);

    const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
    expect(images).toHaveLength(7);
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
