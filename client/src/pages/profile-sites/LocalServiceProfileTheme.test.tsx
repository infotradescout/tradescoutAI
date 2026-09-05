// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LA_PLUMBING_PROFILE_PRESENTATION } from "@shared/localServiceProfile";
import { LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION } from "@shared/louisianaStoneSolutionsProfile";
import type { ResolvedProfileGalleryItem } from "@shared/profileGalleryShare";
import LocalServiceProfileTheme from "./LocalServiceProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("@/components/ShareButton", () => ({
  ShareButton: ({ destination, label }: { destination: string; label: string }) => (
    <button type="button" data-testid="share-action" data-destination={destination}>
      {label}
    </button>
  ),
}));

const galleryItems: ResolvedProfileGalleryItem[] = Array.from({ length: 3 }, (_, index) => ({
  itemType: "gallery",
  title: `Completed project ${index + 1}`,
  hasPublicTitle: true,
  description: `Project description ${index + 1}`,
  imageUrl: `/project-${index + 1}.jpg`,
  imageAlt: `Project ${index + 1}`,
  slug: `project-${index + 1}`,
  blockIndex: 0,
  imageIndex: index,
}));

const recommendations = [
  ...Array.from({ length: 8 }, (_, index) => ({
    id: `positive-${index + 1}`,
    recommendationType: "positive" as const,
    comment: `Positive recommendation ${index + 1}`,
    projectType: "Plumbing",
    customerName: `Customer ${index + 1}`,
    contractor: { companyName: "LA Plumbing Solutions" },
  })),
  {
    id: "negative",
    recommendationType: "negative" as const,
    comment: "Negative recommendation",
    projectType: "Plumbing",
    customerName: "Private customer",
    contractor: { companyName: "LA Plumbing Solutions" },
  },
  {
    id: "blank",
    recommendationType: "positive" as const,
    comment: "   ",
    projectType: "Plumbing",
    customerName: "Blank customer",
    contractor: { companyName: "LA Plumbing Solutions" },
  },
];

describe("LocalServiceProfileTheme", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onDirectConnect = vi.fn();
  const sendBeacon = vi.fn(() => true);
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

  beforeEach(() => {
    onDirectConnect.mockClear();
    sendBeacon.mockClear();
    fetchMock.mockClear();
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: sendBeacon });
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.style.overflow = "";
    vi.unstubAllGlobals();
  });

  function renderTheme(overrides: Partial<ComponentProps<typeof LocalServiceProfileTheme>> = {}) {
    act(() => {
      root.render(
        <LocalServiceProfileTheme
          profileSlug="la-plumbing-solutions"
          platformBaseHref="https://www.thetradescout.com"
          businessName="LA Plumbing Solutions"
          presentation={LA_PLUMBING_PROFILE_PRESENTATION}
          onDirectConnect={onDirectConnect}
          hasViewerSession
          tradeScoutReturnHref="https://www.thetradescout.com/"
          profileShareDestination="/u/la-plumbing-solutions"
          publicRouteContentBlocks={{ gallery: true }}
          galleryItems={galleryItems}
          sharedGallerySlug="project-2"
          recommendationsDirectory={recommendations}
          trustActions={<div data-testid="trust-actions">Trust actions</div>}
          profileItems={<div data-testid="profile-items">Profile items</div>}
          verificationStatus="approved"
          verifiedBadge
          communityVerification={{
            score: 84,
            scoreHistoryStartsAt: "2026-01-02T00:00:00.000Z",
            lifetimeScoreChange: 4,
            scoreChange30d: 2,
            scoreChange30dComparedAt: "2026-06-01T00:00:00.000Z",
            activePolicyBoostPoints: 3,
            activeBoosts: [],
            badges: [],
            computedAt: "2026-07-01T00:00:00.000Z",
          }}
          {...overrides}
        />
      );
    });
  }

  it("keeps header and mobile request/call controls protected without tel or mailto links", () => {
    renderTheme();
    expect(container.innerHTML).not.toMatch(/href="(?:tel|mailto):/);
    const protectedControls = [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
      (button) =>
        button.textContent?.includes("Start a Request") ||
        button.textContent?.includes("Call LA Plumbing")
    );
    expect(protectedControls).toHaveLength(5);
    for (const control of protectedControls) act(() => control.click());
    expect(onDirectConnect).toHaveBeenCalledTimes(5);
    expect(sendBeacon).toHaveBeenCalledTimes(5);
  });

  it("renders services and financing and routes both through protected Direct Connect", () => {
    renderTheme();
    expect(container.textContent).toContain("Repairs, leaks & replacements");
    expect(container.textContent).toContain("Ask about financing");
    const service = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Repairs, leaks & replacements")
    );
    const financing = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      button.textContent?.includes("Ask about financing")
    );
    act(() => service?.click());
    act(() => financing?.click());
    expect(onDirectConnect).toHaveBeenCalledTimes(2);
  });

  it("keeps directions and website external while tracking them non-blockingly", () => {
    renderTheme();
    const directions = [...container.querySelectorAll<HTMLAnchorElement>("a")].find(
      (link) => link.textContent?.trim() === "Directions"
    );
    const website = [...container.querySelectorAll<HTMLAnchorElement>("a")].find(
      (link) => link.textContent?.trim() === "Website"
    );
    expect(directions?.target).toBe("_blank");
    expect(website?.target).toBe("_blank");
    act(() => directions?.click());
    act(() => website?.click());
    expect(sendBeacon).toHaveBeenCalledTimes(2);
    expect(onDirectConnect).not.toHaveBeenCalled();
  });

  it("opens, shares, advances, reverses, escapes, closes, and restores gallery body lock", () => {
    renderTheme();
    act(() =>
      container.querySelector<HTMLButtonElement>('[aria-label="Open Completed project 1"]')?.click()
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    expect(container.textContent).toContain("1 of 3");
    const dialogShare = [
      ...container.querySelectorAll<HTMLElement>('[data-testid="share-action"]'),
    ].find((button) => button.dataset.destination?.includes("/gallery/project-1"));
    expect(dialogShare).toBeDefined();
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Next photo"]')?.click());
    expect(container.textContent).toContain("2 of 3");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" })));
    expect(container.textContent).toContain("1 of 3");
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("");

    act(() =>
      container.querySelector<HTMLButtonElement>('[aria-label="Open Completed project 2"]')?.click()
    );
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Close gallery"]')?.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("publishes only six nonblank positive recommendations", () => {
    renderTheme();
    const section = [...container.querySelectorAll("section")].find((candidate) =>
      candidate.textContent?.includes("Customer recommendations")
    );
    expect(section?.querySelectorAll("article")).toHaveLength(6);
    expect(section?.textContent).toContain("Positive recommendation 6");
    expect(section?.textContent).not.toContain("Positive recommendation 7");
    expect(section?.textContent).not.toContain("Negative recommendation");
    expect(section?.textContent).not.toContain("Blank customer");
  });

  it("keeps verification, CVS, trust, items, and TradeScout handoff visible in order", () => {
    renderTheme();
    expect(container.textContent).toContain("Verified business");
    expect(container.textContent).toContain("Community Verification Score · 84");
    expect(container.textContent).toContain("Active policy boosts: +3");
    const items = container.querySelector('[data-testid="profile-items"]');
    const trust = container.querySelector('[data-testid="trust-actions"]');
    const handoff = [...container.querySelectorAll("a")].find(
      (link) => link.textContent?.trim() === "Powered by TradeScout"
    );
    expect(items).not.toBeNull();
    expect(trust).not.toBeNull();
    expect(handoff).toBeDefined();
    expect(items?.compareDocumentPosition(trust as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(trust?.compareDocumentPosition(handoff as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("hides the verified badge when approval is absent while retaining nonbadge trust content", () => {
    renderTheme({ verificationStatus: "pending", verifiedBadge: true });
    expect(container.textContent).not.toContain("Verified business");
    expect(container.textContent).toContain("Credentials and trust");
    expect(container.textContent).toContain("Community Verification Score · 84");
    expect(container.textContent).toContain("View credential numbers (5)");
    expect(container.textContent).not.toContain("TradeScout verification confirms");
    expect(container.querySelector('[data-testid="trust-actions"]')).not.toBeNull();
    expect(container.textContent).toContain("Powered by TradeScout");
  });

  it("uses the LSS section titles and gives the about copy full width without a photo", () => {
    renderTheme({
      profileSlug: "louisiana-stone-solutions",
      businessName: "Louisiana Stone Solutions",
      presentation: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION,
      verificationStatus: "pending",
      verifiedBadge: false,
      communityVerification: null,
    });

    expect(container.querySelector("#services h2")?.textContent).toBe(
      LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.servicesTitle
    );
    expect(container.querySelector("#work h2")?.textContent).toBe(
      LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.galleryTitle
    );
    const sectionNav = container.querySelector('[aria-label="Profile sections"]');
    expect(sectionNav?.textContent).toContain("Photos");
    expect(sectionNav?.textContent).not.toContain("Work");
    const aboutSection = container.querySelector("#company");
    expect(aboutSection?.querySelector("img")).toBeNull();
    expect(aboutSection?.textContent).toContain(
      LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION.aboutBody
    );
    expect(aboutSection?.firstElementChild?.className).not.toContain(
      "grid-cols-[230px_minmax(0,1fr)]"
    );
    act(() =>
      container.querySelector<HTMLButtonElement>('#work button[aria-label^="Open "]')?.click()
    );
    expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe(
      "Louisiana Stone Solutions photo gallery"
    );
  });

  it("omits empty trust details for unverified LSS while preserving trust actions", () => {
    renderTheme({
      profileSlug: "louisiana-stone-solutions",
      businessName: "Louisiana Stone Solutions",
      presentation: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION,
      verificationStatus: "pending",
      verifiedBadge: false,
      communityVerification: null,
    });

    expect(container.textContent).not.toContain("Verified business");
    expect(container.textContent).not.toContain("Credentials and trust");
    expect(container.textContent).not.toContain("TradeScout verification confirms");
    expect(container.textContent).not.toContain("View credential numbers");
    expect(container.textContent).not.toContain("Community Verification Score");
    expect(container.querySelector('[data-testid="trust-actions"]')).not.toBeNull();
    const service = [...container.querySelectorAll<HTMLButtonElement>("#services button")].find(
      (button) => button.textContent?.includes("Countertops")
    );
    expect(service).toBeDefined();
    act(() => service?.click());
    expect(onDirectConnect).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).not.toMatch(/href="(?:tel|mailto):/);
  });

  it("keeps a zero CVS visible without inventing verification or empty credential controls", () => {
    renderTheme({
      presentation: LOUISIANA_STONE_SOLUTIONS_PROFILE_PRESENTATION,
      verificationStatus: "pending",
      verifiedBadge: false,
      communityVerification: {
        score: 0,
        scoreHistoryStartsAt: null,
        lifetimeScoreChange: null,
        scoreChange30d: null,
        scoreChange30dComparedAt: null,
        activePolicyBoostPoints: 0,
        activeBoosts: [],
        badges: [],
        computedAt: null,
      },
    });

    expect(container.textContent).toContain("Community Verification Score · 0");
    expect(container.textContent).not.toContain("View credential numbers");
    expect(container.textContent).not.toContain("TradeScout verification confirms");
    expect(container.textContent).not.toContain("Verified business");
    expect(container.querySelector('[data-testid="trust-actions"]')).not.toBeNull();
  });

  it("retains credential evidence without treating it as profile verification", () => {
    renderTheme({
      verificationStatus: "pending",
      verifiedBadge: false,
      communityVerification: null,
    });

    expect(container.textContent).toContain("View credential numbers (5)");
    expect(container.textContent).toContain("CL 75460");
    expect(container.textContent).toContain(LA_PLUMBING_PROFILE_PRESENTATION.credentialDisclosure);
    expect(container.textContent).not.toContain("TradeScout verification confirms");
    expect(container.textContent).not.toContain("Verified business");
    expect(container.textContent).not.toContain("Community Verification Score");
  });

  it("retains verified identity details without credentials or CVS", () => {
    renderTheme({
      presentation: { ...LA_PLUMBING_PROFILE_PRESENTATION, credentials: [] },
      communityVerification: null,
    });

    expect(container.textContent).toContain("Verified business");
    expect(container.textContent).toContain(
      LA_PLUMBING_PROFILE_PRESENTATION.verificationHistoryNote
    );
    expect(container.textContent).not.toContain("View credential numbers");
    expect(container.textContent).not.toContain(
      LA_PLUMBING_PROFILE_PRESENTATION.credentialDisclosure
    );
    expect(container.textContent).not.toContain("Community Verification Score");
  });

  it("retains the photo column and default section titles when no custom titles are supplied", () => {
    renderTheme({
      presentation: { ...LA_PLUMBING_PROFILE_PRESENTATION, servicesTitle: "", galleryTitle: "" },
    });

    expect(container.querySelector("#services h2")?.textContent).toBe("What do you need?");
    expect(container.querySelector("#work h2")?.textContent).toBe("Recent work");
    expect(container.querySelector("#company img")?.getAttribute("src")).toBe(
      LA_PLUMBING_PROFILE_PRESENTATION.aboutImage
    );
    expect(container.querySelector("#company")?.firstElementChild?.className).toContain(
      "grid-cols-[230px_minmax(0,1fr)]"
    );
  });

  it("falls back to fetch when beacon declines and never blocks the protected action", () => {
    sendBeacon.mockReturnValue(false);
    fetchMock.mockRejectedValueOnce(new Error("analytics unavailable"));
    renderTheme();
    const headerRequest = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.includes("Start a Request")
    );
    act(() => headerRequest?.click());
    expect(onDirectConnect).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/shell",
      expect.objectContaining({ method: "POST", keepalive: true })
    );
  });
});
