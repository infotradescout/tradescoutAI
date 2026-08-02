// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import TradeScoutProfileHandoff from "./TradeScoutProfileHandoff";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("TradeScoutProfileHandoff", () => {
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

  it("renders exactly one Powered by TradeScout link across platform hosts", () => {
    act(() => {
      root.render(
        <TradeScoutProfileHandoff
          profileSlug="example-business"
          profileName="Example Business"
          className="profile-footer-proof"
        />
      );
    });

    const footer = container.querySelector('[data-testid="profile-tradescout-handoff"]');
    const platformLink = footer?.querySelector<HTMLAnchorElement>("a");
    expect(footer?.className).toContain("profile-footer-proof");
    expect(footer?.querySelectorAll("a")).toHaveLength(1);
    expect(platformLink?.textContent?.trim()).toBe("Powered by TradeScout");
    expect(platformLink?.getAttribute("href")).toBe("/");

    act(() => {
      root.render(
        <TradeScoutProfileHandoff
          profileSlug="example-business"
          profileName="Example Business"
          platformBaseHref="https://www.thetradescout.com/"
        />
      );
    });

    const customDomainLink = container.querySelector<HTMLAnchorElement>(
      '[data-testid="profile-tradescout-powered-link"]'
    );
    expect(customDomainLink?.getAttribute("href")).toBe("https://www.thetradescout.com/");
    for (const legacyHref of ["/scout", "/community-feed", "/exchange", "/homes"]) {
      expect(container.querySelector(`a[href*="${legacyHref}"]`)).toBeNull();
    }
  });
});
