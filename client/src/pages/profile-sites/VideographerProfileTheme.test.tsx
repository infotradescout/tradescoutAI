// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VideographerProfileTheme from "./VideographerProfileTheme";

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
  { type: "siteTemplate", data: { id: "videographer" } },
  {
    type: "hero",
    data: {
      title: "A better view",
      text: "Drone photo and video for properties and job sites.",
      imageUrl: "/media/hero.jpg",
      featuredWorkUrl: "https://www.instagram.com/reel/DWRwdNLEcDF/",
      logoUrl: "/media/logo.jpg",
      operatorName: "Cameron",
      locationLabel: "Pensacola, Florida",
      instagramUrl: "https://www.instagram.com/precisionaerialservice/",
      instagramHandle: "@PrecisionAerialService",
      tiktokUrl: "https://www.tiktok.com/@chillshots",
      tiktokHandle: "@chillshots",
    },
  },
  {
    type: "gallery",
    data: {
      images: [
        {
          imageUrl: "/media/hero.jpg",
          title: "Pensacola aerial reel",
        },
      ],
    },
  },
];

const galleryItems = [
  {
    itemType: "gallery" as const,
    title: "Pensacola aerial reel",
    hasPublicTitle: true,
    description: "Watch the original reel.",
    imageUrl: "/media/hero.jpg",
    imageAlt: "Pensacola aerial reel",
    slug: "pensacola-aerial-reel-example",
    blockIndex: 2,
    imageIndex: 0,
  },
];

describe("VideographerProfileTheme", () => {
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

  it("renders the actual work before services with identity and exact social handles", () => {
    act(() => {
      root.render(
        <VideographerProfileTheme
          profileSlug="precision-aerial-services"
          businessName="Precision Aerial Services"
          headline="Drone photo and video for real estate, roofs, and construction progress."
          contentBlocks={contentBlocks}
          services={[
            "Real estate photo and video",
            "Roof inspection imagery",
            "Construction progress photos",
          ]}
          serviceAreas={["Pensacola, Florida"]}
          aboutText="Cameron creates drone photo and video around Pensacola."
          galleryItems={galleryItems}
          profileShareDestination="/u/precision-aerial-services"
          onDirectConnect={onDirectConnect}
          trustActions={<div data-testid="trust-actions">Trust actions</div>}
        />
      );
    });

    const portfolio = container.querySelector("#work");
    const services = container.querySelector("#services");

    expect(portfolio).not.toBeNull();
    expect(services).not.toBeNull();
    if (!portfolio || !services) throw new Error("Expected portfolio and services sections");
    expect(
      portfolio.compareDocumentPosition(services) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(container.textContent).toContain("Precision Aerial Services");
    expect(container.textContent).toContain("Cameron");
    expect(container.textContent).toContain("Pensacola, Florida");
    expect(container.textContent).toContain("@PrecisionAerialService");
    expect(container.textContent).toContain("@chillshots");
    expect(container.textContent).toContain("A better view");
    expect(
      container.querySelector('[data-testid="videographer-instagram-consent"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="videographer-instagram-embed"]')).toBeNull();
    act(() => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.includes("Play featured reel"))
        ?.click();
    });
    expect(
      container.querySelector<HTMLIFrameElement>('[data-testid="videographer-instagram-embed"]')
        ?.src
    ).toBe("https://www.instagram.com/reel/DWRwdNLEcDF/embed/");
    expect(container.querySelector('[data-testid="trust-actions"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="tradescout-handoff"]')).not.toBeNull();
    expect(container.textContent).toContain("Powered by TradeScout");
  });

  it("opens Direct Connect from the primary action and portfolio images in a dialog", () => {
    act(() => {
      root.render(
        <VideographerProfileTheme
          profileSlug="precision-aerial-services"
          businessName="Precision Aerial Services"
          contentBlocks={contentBlocks}
          services={["Real estate photo and video"]}
          serviceAreas={["Pensacola, Florida"]}
          galleryItems={galleryItems}
          profileShareDestination="/u/precision-aerial-services"
          onDirectConnect={onDirectConnect}
          trustActions={<div>Trust actions</div>}
        />
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="videographer-primary-direct-connect"]')
        ?.click();
    });
    expect(onDirectConnect).toHaveBeenCalledTimes(1);
    expect(onDirectConnect).toHaveBeenLastCalledWith();

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Request Real estate photo and video"]'
        )
        ?.click();
    });
    expect(onDirectConnect).toHaveBeenLastCalledWith("Real estate photo and video");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Open Pensacola aerial reel"]')
        ?.click();
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      container.querySelector(
        'button[aria-label="Share Pensacola aerial reel | Precision Aerial Services"]'
      )
    ).not.toBeNull();
  });

  it("keeps identity, plain copy, and Direct Connect visible beside native video", () => {
    const videoBlocks = [
      {
        type: "hero",
        data: {
          title: "A better view",
          text: "Drone photo and video.",
          videoUrl: "/media/reel.mp4",
          posterUrl: "/media/hero.jpg",
          operatorName: "Cameron",
          credentialLabel: "Unsupported credential",
        },
      },
    ];

    act(() => {
      root.render(
        <VideographerProfileTheme
          profileSlug="precision-aerial-services"
          businessName="Precision Aerial Services"
          contentBlocks={videoBlocks}
          services={[]}
          serviceAreas={[]}
          galleryItems={[]}
          profileShareDestination="/u/precision-aerial-services"
          onDirectConnect={onDirectConnect}
          trustActions={<div>Trust actions</div>}
        />
      );
    });

    expect(container.querySelector("video[controls]")).not.toBeNull();
    expect(container.querySelector("h1")?.classList.contains("sr-only")).toBe(false);
    expect(container.textContent).toContain("Cameron");
    expect(container.textContent).toContain("A better view");
    expect(container.textContent).toContain("Drone photo and video.");
    expect(
      container.querySelector('[data-testid="videographer-primary-direct-connect"]')
    ).not.toBeNull();
    expect(container.textContent).not.toContain("Unsupported credential");
  });

  it("loads an official Instagram reel only after consent without an empty portfolio warning", () => {
    act(() => {
      root.render(
        <VideographerProfileTheme
          profileSlug="precision-aerial-services"
          businessName="Precision Aerial Services"
          contentBlocks={contentBlocks}
          services={["Real estate photo and video"]}
          serviceAreas={["Pensacola, Florida"]}
          galleryItems={[]}
          profileShareDestination="/u/precision-aerial-services"
          onDirectConnect={onDirectConnect}
          trustActions={<div>Trust actions</div>}
        />
      );
    });

    expect(container.querySelector('[data-testid="videographer-instagram-embed"]')).toBeNull();
    expect(container.textContent).toContain(
      "Playing loads Instagram content and shares browser data with Meta."
    );
    act(() => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.includes("Play featured reel"))
        ?.click();
    });
    const embed = container.querySelector<HTMLIFrameElement>(
      '[data-testid="videographer-instagram-embed"]'
    );
    expect(embed?.getAttribute("src")).toBe("https://www.instagram.com/reel/DWRwdNLEcDF/embed/");
    expect(container.querySelector("#work")).toBeNull();
    expect(container.textContent).not.toContain("Portfolio media has not been added yet.");
  });

  it("does not expose pending-owner custody language on the public profile", () => {
    act(() => {
      root.render(
        <VideographerProfileTheme
          profileSlug="precision-aerial-services"
          businessName="Precision Aerial Services"
          contentBlocks={contentBlocks}
          services={[]}
          serviceAreas={["Pensacola, Florida"]}
          galleryItems={[]}
          profileShareDestination="/u/precision-aerial-services"
          onDirectConnect={onDirectConnect}
          deliveryCustody="tradescout_pending_owner"
          trustActions={<div>Trust actions</div>}
        />
      );
    });

    expect(
      container.querySelector('[data-testid="videographer-pending-owner-disclosure"]')
    ).toBeNull();
    expect(container.textContent).not.toContain("TradeScout holds requests");
  });

  it("renders a clean identity-first hero when media is absent", () => {
    act(() => {
      root.render(
        <VideographerProfileTheme
          profileSlug="precision-aerial-services"
          businessName="Precision Aerial Services"
          contentBlocks={[
            {
              type: "hero",
              data: {
                title: "A better view",
                operatorName: "Cameron",
                locationLabel: "Pensacola, Florida",
              },
            },
          ]}
          services={[]}
          serviceAreas={[]}
          galleryItems={[]}
          profileShareDestination="/u/precision-aerial-services"
          onDirectConnect={onDirectConnect}
          trustActions={<div>Trust actions</div>}
        />
      );
    });

    expect(container.textContent).toContain("A better view");
    expect(container.textContent).toContain("Cameron");
    expect(container.textContent).toContain("Pensacola, Florida");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(container.textContent).not.toContain("Portfolio media has not been added yet.");
  });

  it("caps the selected service context sent to Direct Connect at 180 characters", () => {
    const longService = `Aerial ${"documentation ".repeat(20)}`;

    act(() => {
      root.render(
        <VideographerProfileTheme
          profileSlug="precision-aerial-services"
          businessName="Precision Aerial Services"
          contentBlocks={contentBlocks}
          services={[longService]}
          serviceAreas={["Pensacola, Florida"]}
          galleryItems={[]}
          profileShareDestination="/u/precision-aerial-services"
          onDirectConnect={onDirectConnect}
          trustActions={<div>Trust actions</div>}
        />
      );
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('#services button[aria-label^="Request "]')
        ?.click();
    });

    expect(onDirectConnect).toHaveBeenCalledTimes(1);
    const [serviceContext] = onDirectConnect.mock.calls[0] || [];
    expect(serviceContext).toHaveLength(180);
    expect(serviceContext).toBe(longService.trim().slice(0, 180));
  });
});
