// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedProfileGalleryItem } from "@shared/profileGalleryShare";
import JrsAutoGlassProfileTheme from "./JrsAutoGlassProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("./TradeScoutProfileHandoff", () => ({
  default: () => <footer data-testid="tradescout-handoff">Powered by TradeScout</footer>,
}));

vi.mock("@/components/ShareButton", () => ({
  ShareButton: ({ destination, title }: { destination: string; title: string }) => (
    <button type="button" data-testid="gallery-share" data-destination={destination} title={title}>
      Share
    </button>
  ),
}));

const recommendations = [
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `positive-${index + 1}`,
    recommendationType: "positive" as const,
    comment: `Positive recommendation ${index + 1}`,
    projectType: index % 2 ? "Repair" : "Replacement",
    customerName: `Customer ${index + 1}`,
    contractor: { companyName: "JR's Auto Glass" },
  })),
  {
    id: "negative-1",
    recommendationType: "negative" as const,
    comment: "Private negative recommendation",
    projectType: "Repair",
    customerName: "Negative customer",
    contractor: { companyName: "JR's Auto Glass" },
  },
];

const galleryItems: ResolvedProfileGalleryItem[] = Array.from({ length: 3 }, (_, index) => ({
  itemType: "gallery",
  title: `Gallery override ${index + 1}`,
  hasPublicTitle: true,
  description: `Override description ${index + 1}`,
  imageUrl: `/override-${index + 1}.webp`,
  imageAlt: `Override image ${index + 1}`,
  slug: `override-${index + 1}`,
  blockIndex: 0,
  imageIndex: index,
}));

describe("JrsAutoGlassProfileTheme", () => {
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

  function renderTheme(
    overrides: {
      galleryItems?: ResolvedProfileGalleryItem[];
      recommendationsDirectory?: typeof recommendations | [];
    } = {}
  ) {
    act(() => {
      root.render(
        <JrsAutoGlassProfileTheme
          profileSlug="jrs-auto-glass"
          platformBaseHref="https://www.thetradescout.com"
          onDirectConnect={onDirectConnect}
          hasViewerSession
          tradeScoutReturnHref="https://www.thetradescout.com/"
          profileShareDestination="/u/jrs-auto-glass"
          publicRouteContentBlocks={{ gallery: true }}
          galleryItems={overrides.galleryItems}
          sharedGallerySlug="override-2"
          recommendationsDirectory={overrides.recommendationsDirectory ?? recommendations}
          trustActions={<div data-testid="trust-actions">Trust actions</div>}
          profileItems={<div data-testid="profile-items">Profile items</div>}
        />
      );
    });
  }

  it("renders branded assets, services, trust, profile items, and handoff in owned order", () => {
    renderTheme();
    for (const asset of ["logo.webp", "cover.webp"]) {
      expect(
        container.querySelector(`img[src$="/images/businesses/jrs-auto-glass/${asset}"]`)
      ).not.toBeNull();
    }
    for (const service of [
      "Windshield replacement",
      "Rock chip repair",
      "Mobile service",
      "Auto glass installation",
    ]) {
      expect(container.textContent).toContain(service);
    }
    const trust = container.querySelector('[data-testid="profile-trust-section"]');
    const services = [...container.querySelectorAll("h2")].find(
      (heading) => heading.textContent === "Services"
    );
    const items = container.querySelector('[data-testid="profile-items"]');
    const handoff = container.querySelector('[data-testid="tradescout-handoff"]');
    expect(container.querySelector('[data-testid="trust-actions"]')).not.toBeNull();
    expect(trust?.compareDocumentPosition(services as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(items?.compareDocumentPosition(handoff as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("routes all three Direct Connect controls through one callback", () => {
    renderTheme();
    const controls = [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
      (button) =>
        button.textContent?.includes("Direct Connect") ||
        button.ariaLabel?.includes("Direct Connect")
    );
    expect(controls).toHaveLength(3);
    for (const control of controls) act(() => control.click());
    expect(onDirectConnect).toHaveBeenCalledTimes(3);
  });

  it("prefers the supplied gallery, caps it at two, labels before/after, and owns share paths", () => {
    renderTheme({ galleryItems });
    expect(container.querySelector('img[src="/override-1.webp"]')).not.toBeNull();
    expect(container.querySelector('img[src="/override-2.webp"]')).not.toBeNull();
    expect(container.querySelector('img[src="/override-3.webp"]')).toBeNull();
    expect(container.textContent).toContain("Before");
    expect(container.textContent).toContain("After");
    const shares = [...container.querySelectorAll<HTMLElement>('[data-testid="gallery-share"]')];
    expect(shares).toHaveLength(2);
    expect(shares[0]?.dataset.destination).toContain("/u/jrs-auto-glass/gallery/override-1");
    expect(container.querySelector("#profile-gallery-override-2")?.className).toContain("ring-2");
  });

  it("uses the canonical before-and-after gallery when no override is supplied", () => {
    renderTheme({ galleryItems: [] });
    expect(
      container.querySelector('img[src="/images/businesses/jrs-auto-glass/before.webp"]')
    ).not.toBeNull();
    expect(
      container.querySelector('img[src="/images/businesses/jrs-auto-glass/after.webp"]')
    ).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="gallery-share"]')).toHaveLength(2);
  });

  it("publishes only the first six positive recommendations and retains the empty state", () => {
    renderTheme();
    const section = [...container.querySelectorAll("section")].find((candidate) =>
      candidate.textContent?.includes("Customer recommendations")
    );
    for (let index = 1; index <= 6; index += 1) {
      expect(section?.textContent).toContain(`Positive recommendation ${index}`);
    }
    expect(section?.textContent).not.toContain("Positive recommendation 7");
    expect(section?.textContent).not.toContain("Private negative recommendation");

    renderTheme({ recommendationsDirectory: [] });
    expect(container.textContent).toContain("0 customer recommendations have been published.");
  });
});
