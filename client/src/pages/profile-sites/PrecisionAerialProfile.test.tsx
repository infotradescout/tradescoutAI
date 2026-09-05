// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEMES } from "@/lib/themes";
import PrecisionAerialProfile from "./PrecisionAerialProfile";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("@/components/ShareButton", () => ({
  ShareButton: ({ title }: { title?: string }) => (
    <button type="button" aria-label={`Share ${title || "profile"}`}>
      Share
    </button>
  ),
}));

vi.mock("./TradeScoutProfileHandoff", () => ({
  default: () => <footer data-testid="tradescout-handoff">Powered by TradeScout</footer>,
}));

const onDirectConnect = vi.fn();
const contentBlocks = [
  {
    type: "hero",
    data: {
      title: "A better view.",
      text: "Aerial photo, video, and FPV for real estate, construction, and land.",
      operatorName: "Cameron",
      locationLabel: "Pensacola, Florida",
      logoUrl: "/images/profiles/precision-aerial/logo.jpg",
      imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-01.jpg",
      videoUrl: "/images/profiles/precision-aerial/hero-reel.mp4",
      videoPosterUrl: "/images/profiles/precision-aerial/hero-reel-poster.jpg",
      featuredWorkUrl: "https://www.instagram.com/reel/DWRwdNLEcDF/",
      instagramUrl: "https://www.instagram.com/precisionaerialservice/",
      instagramHandle: "@PrecisionAerialService",
      tiktokUrl: "https://www.tiktok.com/@chillshots",
      tiktokHandle: "@chillshots",
      upcomingService: "Thermal imaging",
    },
  },
];

const galleryItems = [
  {
    itemType: "gallery" as const,
    title: "Property overview",
    hasPublicTitle: true,
    description: "A wide property view captured from the air.",
    imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-01.jpg",
    imageAlt: "Wide aerial property view",
    slug: "property-overview",
    blockIndex: 1,
    imageIndex: 0,
  },
  {
    itemType: "gallery" as const,
    title: "Closer property view",
    hasPublicTitle: true,
    description: "A closer aerial angle showing the property.",
    imageUrl: "/images/profiles/precision-aerial/real-estate-aerial-02.jpg",
    imageAlt: "Closer aerial property view",
    slug: "closer-property-view",
    blockIndex: 1,
    imageIndex: 1,
  },
];

const services = [
  "Real estate aerial photo and video",
  "Construction progress imagery",
  "Land and site aerials",
  "FPV drone video",
];

describe("PrecisionAerialProfile", () => {
  let container: HTMLDivElement;
  let root: Root;

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

  it("renders a company-led profile with a real TradeScout project path before reusable theming", () => {
    act(() => {
      root.render(
        <PrecisionAerialProfile
          profileSlug="precision-aerial-services"
          businessName="Precision Aerial Services"
          headline="FAA Part 107 aerial photo and video in Pensacola."
          contentBlocks={contentBlocks}
          services={services}
          serviceAreas={["Pensacola, Florida"]}
          aboutText="Cameron is a Pensacola-based FAA Part 107 licensed drone pilot."
          galleryItems={galleryItems}
          profileShareDestination="/u/precision-aerial-services"
          onDirectConnect={onDirectConnect}
          deliveryCustody="tradescout_pending_owner"
          trustActions={<div data-testid="trust-actions">Trust</div>}
        />
      );
    });

    const profile = container.querySelector<HTMLElement>(
      '[data-testid="precision-aerial-profile"]'
    );
    const heroMedia = container.querySelector('[data-testid="precision-aerial-hero-video"]');
    const heroIdentity = container.querySelector('[data-testid="precision-aerial-header"]');
    const work = container.querySelector('[data-testid="precision-aerial-work"]');
    const serviceSection = container.querySelector('[data-testid="precision-aerial-services"]');

    expect(profile?.style.getPropertyValue("--precision-primary")).toBe(
      THEMES.midnight["--ts-accent"]
    );
    expect(heroMedia).not.toBeNull();
    expect((heroMedia as HTMLVideoElement).autoplay).toBe(true);
    expect((heroMedia as HTMLVideoElement).muted).toBe(true);
    expect((heroMedia as HTMLVideoElement).loop).toBe(true);
    expect((heroMedia as HTMLVideoElement).playsInline).toBe(true);
    expect(heroMedia?.getAttribute("poster")).toBe(
      "/images/profiles/precision-aerial/hero-reel-poster.jpg"
    );
    expect(heroIdentity).not.toBeNull();
    expect(heroIdentity?.compareDocumentPosition(heroMedia as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(work).not.toBeNull();
    expect(serviceSection).not.toBeNull();
    expect(work?.compareDocumentPosition(serviceSection as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(container.textContent).toContain("Precision Aerial Services");
    expect(container.textContent?.match(/Cameron/g)).toHaveLength(1);
    expect(container.textContent).toContain("A better view.");
    expect(container.textContent).toContain("FAA Part 107");
    expect(container.textContent).toContain("FPV");
    expect(container.textContent).toContain("Coming soon");
    expect(container.textContent).toContain("Thermal imaging");
    expect(container.textContent).not.toContain("No lead auction");
    expect(container.textContent).not.toContain("Direct Connect");
    expect(container.textContent).toContain("@PrecisionAerialService");
    expect(container.textContent).toContain("@chillshots");
    expect(container.querySelector('img[alt="Closer aerial property view"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid^="precision-aerial-service-"]')).toHaveLength(
      4
    );
    expect(container.querySelector('[data-testid="trust-actions"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tradescout-handoff"]')).not.toBeNull();
    expect(container.textContent).toContain("Powered by TradeScout");
  });

  it("preserves primary and service-specific Direct Connect and gallery sharing", () => {
    act(() => {
      root.render(
        <PrecisionAerialProfile
          profileSlug="precision-aerial-services"
          businessName="Precision Aerial Services"
          contentBlocks={contentBlocks}
          services={services}
          serviceAreas={["Pensacola, Florida"]}
          galleryItems={galleryItems}
          profileShareDestination="/u/precision-aerial-services"
          onDirectConnect={onDirectConnect}
          trustActions={<div>Trust</div>}
        />
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="precision-primary-direct-connect"]')
        ?.click();
    });
    expect(onDirectConnect).toHaveBeenLastCalledWith();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Book Land and site aerials"]')
        ?.click();
    });
    expect(onDirectConnect).toHaveBeenLastCalledWith("Land and site aerials");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Book Construction progress imagery"]')
        ?.click();
    });
    expect(onDirectConnect).toHaveBeenLastCalledWith("Construction progress imagery");
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="precision-project-brief-submit"]')
        ?.click();
    });
    expect(onDirectConnect).toHaveBeenLastCalledWith("Construction progress imagery");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Open Closer property view"]')
        ?.click();
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      container.querySelector(
        'button[aria-label="Share Closer property view | Precision Aerial Services"]'
      )
    ).not.toBeNull();
  });
});
