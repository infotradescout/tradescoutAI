// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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
        <SteelHomePackagesProfile requestHref={STEEL_HOME_PACKAGES_START_REQUEST_PATH} />
      );
    });
  }

  it("renders the approved package story in its required order", () => {
    renderProfile();

    const text = container.textContent || "";
    expect(text).toContain(content.hero.headline);
    expect(text).toContain(content.hero.body);
    expect(text).toContain("Steel structures and metal-building packages");
    expect(text).toContain("Cabinet packages");
    expect(text).toContain("Natural stone");
    expect(text).toContain("Full-size steel homes");
    expect(text).toContain("First focus");
    expect(text).toContain("Next-generation single-wide homes");
    expect(text).toContain("In development");
    expect(text).toContain("Steel tiny homes");
    expect(text).toContain("Future line");
    expect(text).toContain("Owner-builders");
    expect(text).toContain("Builders");
    expect(text).toContain("Contractors");
    expect(text).toContain(content.mechanical.body);
    expect(text).toContain(content.location.responsibility);
    expect(text).toContain(content.homeId.body);
    expect(text).toContain("Long-term goal");
    expect(text).toContain(content.disclosure);

    const orderedSectionIds = [
      "steel-home-hero",
      "steel-home-available-now",
      "steel-home-paths",
      "steel-home-audiences",
      "steel-home-process",
      "steel-home-mechanical",
      "steel-home-location",
      "steel-home-home-id",
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

  it("preserves Direct Connect context and avoids unsupported proof or media", () => {
    renderProfile();

    const requestLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('[data-testid="steel-home-start-request"]')
    );
    expect(requestLinks).toHaveLength(2);
    for (const link of requestLinks) {
      expect(link.getAttribute("href")).toBe(STEEL_HOME_PACKAGES_START_REQUEST_PATH);
    }
    expect(container.querySelector<HTMLAnchorElement>('a[href="#available-now"]')).not.toBeNull();
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
