// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProFabProfileTheme from "./ProFabProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("./TradeScoutProfileHandoff", () => ({
  default: () => <footer data-testid="tradescout-handoff">Powered by TradeScout</footer>,
}));

const recommendations = [
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `positive-${index + 1}`,
    recommendationType: "positive" as const,
    comment: `Positive recommendation ${index + 1}`,
    projectType: index % 2 ? "Repair" : "Fabrication",
    customerName: `Customer ${index + 1}`,
  })),
  {
    id: "negative-1",
    recommendationType: "negative" as const,
    comment: "Private negative recommendation",
    projectType: "Repair",
    customerName: "Negative customer",
  },
];

describe("ProFabProfileTheme", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onDirectConnect = vi.fn();

  beforeEach(() => {
    onDirectConnect.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderTheme() {
    act(() => {
      root.render(
        <ProFabProfileTheme
          profileSlug="pro-fab-specialty-services"
          platformBaseHref="https://www.thetradescout.com"
          onDirectConnect={onDirectConnect}
          hasViewerSession
          tradeScoutReturnHref="https://www.thetradescout.com/"
          recommendationsDirectory={recommendations}
          trustActions={<div data-testid="trust-actions">Trust actions</div>}
          profileItems={<div data-testid="profile-items">Profile items</div>}
        />
      );
    });
  }

  it("renders supplied assets, service scope, markets, and owned sections in order", () => {
    renderTheme();

    for (const asset of ["logo.svg", "cover.svg", "capabilities.svg"]) {
      expect(
        container.querySelector(`img[src$="/images/businesses/pro-fab-specialty-services/${asset}"]`)
      ).not.toBeNull();
    }
    for (const service of [
      "Custom metal fabrication",
      "Structural steel fabrication & installation",
      "Pipe fabrication & process piping",
      "Mobile on-site welding & field service",
      "Plant maintenance & shutdown support",
    ]) {
      expect(container.textContent).toContain(service);
    }
    for (const market of ["Industrial", "Commercial", "Residential"]) {
      expect(container.textContent).toContain(market);
    }

    const trust = container.querySelector('[data-testid="profile-trust-section"]');
    const servicesHeading = [...container.querySelectorAll("h2")].find(
      (heading) => heading.textContent === "Services"
    );
    const profileItems = container.querySelector('[data-testid="profile-items"]');
    const handoff = container.querySelector('[data-testid="tradescout-handoff"]');
    expect(container.querySelector('[data-testid="trust-actions"]')).not.toBeNull();
    expect(trust?.compareDocumentPosition(servicesHeading as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(profileItems?.compareDocumentPosition(handoff as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("routes all three Direct Connect controls through the same callback", () => {
    renderTheme();
    const directConnectButtons = [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
      (button) => button.textContent?.includes("Direct Connect") || button.ariaLabel?.includes("Direct Connect")
    );
    expect(directConnectButtons).toHaveLength(3);
    for (const button of directConnectButtons) {
      act(() => button.click());
    }
    expect(onDirectConnect).toHaveBeenCalledTimes(3);
  });

  it("publishes only the first six positive recommendations", () => {
    renderTheme();
    const recommendationSection = [...container.querySelectorAll("section")].find((section) =>
      section.textContent?.includes("Customer recommendations")
    );
    expect(recommendationSection?.querySelectorAll("article")).toHaveLength(6);
    for (let index = 1; index <= 6; index += 1) {
      expect(recommendationSection?.textContent).toContain(`Positive recommendation ${index}`);
    }
    expect(recommendationSection?.textContent).not.toContain("Positive recommendation 7");
    expect(recommendationSection?.textContent).not.toContain("Positive recommendation 8");
    expect(recommendationSection?.textContent).not.toContain("Private negative recommendation");
  });
});
