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

  it("renders only the three approved Phase 1 material relationships", () => {
    renderProfile();

    const text = container.textContent || "";
    expect(text).toContain(content.hero.headline);
    expect(text).toContain(content.hero.body);
    expect(text).toContain("Metal structure");
    expect(text).toContain("Worldwide Steel Buildings");
    expect(text).toContain("Natural stone");
    expect(text).toContain("JW Stone Logistics");
    expect(text).toContain("Cabinets");
    expect(text).toContain("A+ Cabinets");
    expect(text).toContain("Ocean Springs");
    expect(text).toContain("Owner-builders");
    expect(text).toContain("Builders");
    expect(text).toContain("Contractors");
    expect(text).toContain(content.labor.body);
    expect(text).toContain("A request can be labor-only");
    expect(text).toContain(content.location.responsibility);
    expect(text).toContain(content.disclosure);

    const partnerCards = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid^="steel-home-partner-"]')
    );
    expect(partnerCards.map((card) => card.dataset.testid)).toEqual([
      "steel-home-partner-structure",
      "steel-home-partner-stone",
      "steel-home-partner-cabinets",
    ]);

    for (const futurePhaseCopy of [
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
      expect(text.toLowerCase()).not.toContain(futurePhaseCopy.toLowerCase());
    }

    const orderedSectionIds = [
      "steel-home-hero",
      "steel-home-available-now",
      "steel-home-audiences",
      "steel-home-process",
      "steel-home-labor",
      "steel-home-location",
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

  it("keeps package purchasing and local labor as separate Direct Connect paths", () => {
    renderProfile();

    const packageRequestLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-testid="steel-home-start-request"]')
    );
    expect(packageRequestLinks).toHaveLength(2);
    for (const link of packageRequestLinks) {
      expect(link.getAttribute("href")).toBe(STEEL_HOME_PACKAGES_START_REQUEST_PATH);
    }

    const laborRequestLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-testid="steel-home-labor-request"]')
    );
    expect(laborRequestLinks).toHaveLength(3);
    for (const link of laborRequestLinks) {
      expect(link.getAttribute("href")).toBe(STEEL_HOME_PACKAGES_LABOR_REQUEST_PATH);
    }

    expect(container.querySelector<HTMLAnchorElement>('a[href="#available-now"]')).not.toBeNull();
    expect(
      container.querySelector<HTMLAnchorElement>(
        'a[href="https://www.worldwidesteelbuildings.com/3d-building-designer/"]'
      )
    ).not.toBeNull();
    expect(container.querySelector<HTMLAnchorElement>('a[href="/jw-stone"]')).not.toBeNull();
    expect(container.querySelectorAll("img, picture, video")).toHaveLength(0);

    const text = container.textContent || "";
    for (const unsupportedClaim of [
      "starting at",
      "monthly payment",
      "nationwide delivery",
      "five-star",
      "exclusive partner",
      "guaranteed approval",
      "licensed and insured",
      "AI-generated",
    ]) {
      expect(text.toLowerCase()).not.toContain(unsupportedClaim.toLowerCase());
    }
    expect(text).not.toMatch(/\$\s?\d/);
  });
});
