// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_PROFILE_PRESENTATION_BLOCK } from "@/data/jwStoneProfilePresentation";
import WholesalerProfileTheme from "./WholesalerProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const expressPanelProps = vi.fn();

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ["/u/jw-stone", vi.fn()],
}));

vi.mock("@/components/ShareButton", () => ({
  ShareButton: ({ title }: { title?: string }) => (
    <button type="button" aria-label={`Share ${title || "profile"}`}>
      Share
    </button>
  ),
}));

vi.mock("./ExpressDirectConnectPanel", () => ({
  default: (props: Record<string, unknown>) => {
    expressPanelProps(props);
    return props.open ? (
      <div
        data-testid="express-direct-connect-panel"
        data-request-type={String(props.initialRequestType || "")}
      />
    ) : null;
  },
}));

vi.mock("./TradeScoutProfileHandoff", () => ({
  default: () => <div data-testid="tradescout-handoff" />,
}));

const inventoryStones = Array.from({ length: 14 }, (_, index) => ({
  name: `Test Stone ${index + 1}`,
  slug: `test-stone-${index + 1}`,
  images: [`/stone-${index + 1}.jpg`],
  materialStatus: "source_folder" as const,
  finishes: index === 0 ? ["Polished"] : undefined,
  slabCounts: index === 0 ? [5] : undefined,
}));

const contentBlocks = [
  JW_STONE_PROFILE_PRESENTATION_BLOCK,
  {
    type: "about",
    body: "JW Stone source and project support.",
  },
  {
    type: "inventoryCatalog",
    data: {
      title: "Full inventory",
      description: "Browse every named stone.",
      categories: [
        {
          category: "Granite",
          categorySlug: "granite",
          stones: inventoryStones,
        },
      ],
    },
  },
  {
    type: "audience",
    data: {
      items: [
        { title: "Homeowners", body: "Homeowner project guidance." },
        { title: "Fabricators", body: "Fabricator project guidance." },
        { title: "Architects & Designers", body: "Design project guidance." },
        { title: "Builders & Developers", body: "Development project guidance." },
      ],
    },
  },
  {
    type: "faq",
    data: {
      faqs: [
        { question: "How is availability confirmed?", answer: "Ask through Direct Connect." },
        { question: "Can I share a stone?", answer: "Yes, each stone has a share action." },
      ],
    },
  },
];

const nameIdentityContentBlocks = contentBlocks.map((block) =>
  block.type === "inventoryCatalog"
    ? {
        ...block,
        data: {
          title: "Full inventory",
          description: "Browse every named stone.",
          categories: [
            {
              category: "Material to Confirm",
              categorySlug: "unconfirmed",
              stones: [
                {
                  name: "Amazonic Green",
                  displayName: "Amazonic Green",
                  nameStatus: "source" as const,
                  slug: "amazonic-green",
                  images: ["/amazonic-green.jpg"],
                  materialStatus: "unconfirmed" as const,
                  finishStatus: "unconfirmed" as const,
                },
                ...Array.from({ length: 10 }, (_, index) => {
                  const ordinal = String(index + 1).padStart(2, "0");
                  return {
                    name: `Trending Selection ${ordinal}`,
                    displayName: null,
                    nameStatus: "placeholder" as const,
                    slug: `trending-selection-${ordinal}`,
                    images: [`/trending-selection-${ordinal}.jpg`],
                    materialStatus: "unconfirmed" as const,
                    finishStatus: "unconfirmed" as const,
                  };
                }),
              ],
            },
          ],
        },
      }
    : block
);

const recommendationsDirectory = Array.from({ length: 4 }, (_, index) => ({
  id: `recommendation-${index + 1}`,
  createdAt: null,
  recommendationType: "positive" as const,
  comment: `Recommendation ${index + 1}`,
  projectType: null,
  customerName: `Customer ${index + 1}`,
  contractor: {
    id: "jw",
    companyName: "JW Stone",
    slug: "jw-stone",
  },
}));

const props = {
  profileSlug: "jw-stone",
  displayName: "JW Stone",
  businessAddress: null,
  headline: "Natural stone, selected at the source.",
  contentBlocks,
  categories: ["Natural stone"],
  serviceAreas: ["Test service area"],
  hasViewerSession: false,
  isSuperAdminViewer: false,
  useExpressDirectConnect: true,
  allowExpressCall: false,
  profileShareDestination: "/u/jw-stone",
  tradeScoutReturnHref: "/",
  directConnectHref: "/direct-connect",
  preScoutCreateHref: "/pre-scout-setup?mode=create",
  preScoutSignInHref: "/pre-scout-setup?mode=signin",
  recommendationsDirectory,
  trustActions: <div data-testid="profile-trust-section">Trust</div>,
  profileItems: <div data-testid="profile-items">Preserved profile items</div>,
};

function click(element: Element | null) {
  if (!element) throw new Error("Expected a clickable element");
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function changeInput(element: HTMLInputElement | null, value: string) {
  if (!element) throw new Error("Expected an input");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("WholesalerProfileTheme JW Stone Phase 2", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    expressPanelProps.mockClear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    Element.prototype.scrollIntoView = vi.fn();
    window.scrollTo = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("opens the compact full inventory immediately and preserves all long-form content", () => {
    act(() => {
      root.render(<WholesalerProfileTheme {...props} />);
    });

    const hero = container.querySelector('[data-testid="wholesaler-profile-hero"]');
    expect(hero?.className).not.toContain("min-h-[460px]");
    expect(hero?.className).toContain("md:min-h-[600px]");
    expect(container.querySelector("#inventory-browser")).not.toBeNull();
    expect(container.querySelector('button[aria-label="Back within JW Stone"]')).not.toBeNull();
    expect(container.querySelector('input[placeholder="Search by stone name"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="profile-inventory-card"]')).toHaveLength(12);
    expect(
      container.querySelectorAll('[data-testid="profile-featured-product-card"]')
    ).toHaveLength(0);
    const showMoreInventory = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Show 12 more"
    );
    click(showMoreInventory || null);
    expect(container.querySelectorAll('[data-testid="profile-inventory-card"]')).toHaveLength(14);
    expect(container.querySelectorAll('[data-testid="profile-faq-item"]')).toHaveLength(2);
    expect(container.querySelectorAll('img[src*="/story/"]')).toHaveLength(4);
    expect(container.textContent).toContain("JW Stone source and project support.");
    expect(container.textContent).toContain("Ask through Direct Connect.");
    expect(container.textContent).toContain("Source slab count: 5 slabs");
    expect(container.querySelector('[data-testid="profile-trust-section"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="profile-items"]')).not.toBeNull();
    expect(container.textContent).toContain("Stone or material");
    expect(
      container.querySelector('button[aria-label="View details for Test Stone 1"]')
    ).not.toBeNull();
    expect(container.querySelector('button[aria-label="Ask about Test Stone 1"]')).not.toBeNull();
    expect(container.textContent).toContain("Recommendation 1");
    expect(container.textContent).toContain("Recommendation 3");
    expect(container.textContent).not.toContain("Recommendation 4");

    const showAll = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Show all 4 recommendations")
    );
    click(showAll || null);
    expect(container.textContent).toContain("Recommendation 4");

    const featuredView = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Show featured view"
    );
    click(featuredView || null);
    expect(container.querySelector("#inventory-browser")).toBeNull();
    expect(
      container.querySelectorAll('[data-testid="profile-featured-product-card"]')
    ).toHaveLength(3);
    const reopenInventory = Array.from(container.querySelectorAll("#collection button")).find(
      (button) => button.textContent?.includes("Browse full inventory")
    );
    click(reopenInventory || null);
    expect(container.querySelector("#inventory-browser")).not.toBeNull();
  });

  it("hands Direct Connect the immutable JW item slug alongside its display name", () => {
    act(() => {
      root.render(<WholesalerProfileTheme {...props} />);
    });

    const askButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Ask about Test Stone "]'
    );
    const selectedName = askButton?.getAttribute("aria-label")?.replace(/^Ask about /, "") || "";
    const selectedStone = inventoryStones.find((stone) => stone.name === selectedName);
    expect(selectedStone).toBeDefined();
    click(askButton);

    expect(expressPanelProps.mock.calls.at(-1)?.[0]).toMatchObject({
      open: true,
      initialItemId: selectedStone?.slug,
      initialStoneName: selectedStone?.name,
      initialRequestType: "request_material",
    });
    expect(container.querySelector('[data-testid="express-direct-connect-panel"]')).not.toBeNull();
  });

  it("keeps known stone names visible while synthetic groups stay explicitly unnamed", () => {
    act(() => {
      root.render(<WholesalerProfileTheme {...props} contentBlocks={nameIdentityContentBlocks} />);
    });

    const amazonDetails = container.querySelector(
      'button[aria-label="View details for Amazonic Green"]'
    );
    const inventoryCards = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="profile-inventory-card"]')
    );
    const syntheticCards = inventoryCards.filter((card) =>
      card.querySelector('img[src^="/trending-selection-"]')
    );
    const syntheticFiveCard = syntheticCards.find((card) =>
      card.querySelector('img[src="/trending-selection-05.jpg"]')
    );
    const unnamedDetails = syntheticFiveCard?.querySelector(
      'button[aria-label="View stone selection details"]'
    );
    expect(amazonDetails).not.toBeNull();
    expect(unnamedDetails).not.toBeNull();
    expect(syntheticCards).toHaveLength(10);
    expect(
      syntheticCards.every(
        (card) =>
          card.querySelector('[data-testid="profile-inventory-name"]') === null &&
          card.querySelector('[data-testid="profile-inventory-availability"]')?.textContent ===
            "Call for availability"
      )
    ).toBe(true);
    expect(amazonDetails?.closest("article")?.textContent).toContain(
      "Material & finish pending confirmation"
    );
    expect(unnamedDetails?.closest("article")?.textContent).toContain(
      "Name & finish pending confirmation"
    );
    expect(container.querySelector('button[aria-label="Share Amazonic Green"]')).not.toBeNull();
    expect(
      container.querySelectorAll('button[aria-label="Share Current stone selection"]')
    ).toHaveLength(10);
    expect(container.textContent).toContain("Amazonic Green");
    expect(container.textContent).not.toContain("Unnamed slab");
    expect(container.textContent).not.toContain("Trending Selection 05");

    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search by stone name"]'
    );
    changeInput(search, "Amazonic Green");
    expect(container.querySelectorAll('[data-testid="profile-inventory-card"]')).toHaveLength(1);
    expect(container.textContent).toContain("Amazonic Green");
    changeInput(search, "Trending Selection 05");
    expect(container.querySelectorAll('[data-testid="profile-inventory-card"]')).toHaveLength(0);
    changeInput(search, "Unnamed slab");
    expect(container.querySelectorAll('[data-testid="profile-inventory-card"]')).toHaveLength(0);
    changeInput(search, "");

    const reopenedSyntheticFiveCard = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="profile-inventory-card"]')
    ).find((card) => card.querySelector('img[src="/trending-selection-05.jpg"]'));
    click(
      reopenedSyntheticFiveCard?.querySelector(
        'button[aria-label="View stone selection details"]'
      ) || null
    );
    expect(container.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe(
      "Stone selection photo gallery"
    );
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      "Call for availability"
    );
    expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain(
      "Finish not confirmed"
    );
    expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain("Unnamed slab");
    expect(container.querySelector('[role="dialog"]')?.textContent).not.toContain(
      "Trending Selection 05"
    );
    click(container.querySelector('button[aria-label="Close gallery"]'));

    const syntheticAsk = reopenedSyntheticFiveCard?.querySelector(
      'button[aria-label="Ask about availability for this stone selection"]'
    );
    click(syntheticAsk || null);
    expect(expressPanelProps.mock.calls.at(-1)?.[0]).toMatchObject({
      open: true,
      initialItemId: "trending-selection-05",
      initialStoneName: null,
      initialRequestType: "request_material",
    });

    click(container.querySelector('button[aria-label="Ask about Amazonic Green"]'));
    expect(expressPanelProps.mock.calls.at(-1)?.[0]).toMatchObject({
      open: true,
      initialItemId: "amazonic-green",
      initialStoneName: "Amazonic Green",
      initialRequestType: "request_material",
    });
  });

  it("adapts guidance and Direct Connect intent to the selected customer type", () => {
    act(() => {
      root.render(<WholesalerProfileTheme {...props} />);
    });

    const chooser = container.querySelector('[data-testid="profile-audience-chooser"]');
    expect(chooser).not.toBeNull();
    expect(chooser?.querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(chooser?.querySelectorAll('[role="tabpanel"]')).toHaveLength(1);
    expect(chooser?.textContent).toContain("Fabricators");

    const audienceCases = [
      {
        tab: "Homeowners",
        storedGuidance: "Homeowner project guidance.",
        richerGuidance: "Start with a room, inspiration, or selected stone",
        action: "Match my project",
        requestType: "match_project",
      },
      {
        tab: "Fabricators",
        storedGuidance: "Fabricator project guidance.",
        richerGuidance: "Review named stone, confirmed finishes where listed",
        action: "Ask about a bundle",
        requestType: "ask_about_bundle",
      },
      {
        tab: "Architects & Designers",
        storedGuidance: "Design project guidance.",
        richerGuidance: "Compare stone imagery, category, and confirmed finish details",
        action: "Review a specification",
        requestType: "match_project",
      },
      {
        tab: "Builders & Developers",
        storedGuidance: "Development project guidance.",
        richerGuidance: "Share project volume, location, and timing",
        action: "Match a development",
        requestType: "match_project",
      },
    ];

    for (const audienceCase of audienceCases) {
      const tab = Array.from(chooser?.querySelectorAll('[role="tab"]') || []).find(
        (candidate) => candidate.textContent === audienceCase.tab
      );
      click(tab || null);
      expect(tab?.getAttribute("aria-selected")).toBe("true");
      expect(chooser?.textContent).toContain(audienceCase.storedGuidance);
      expect(chooser?.textContent).toContain(audienceCase.richerGuidance);

      const action = Array.from(chooser?.querySelectorAll("button") || []).find(
        (button) => button.textContent === audienceCase.action
      );
      click(action || null);
      const lastPanelProps = expressPanelProps.mock.calls.at(-1)?.[0];
      expect(lastPanelProps?.initialRequestType).toBe(audienceCase.requestType);
    }

    expect(container.querySelector('[data-testid="express-direct-connect-panel"]')).not.toBeNull();
  });

  it("reveals the complete inventory in-place and keeps search actionable", () => {
    act(() => {
      root.render(<WholesalerProfileTheme {...props} />);
    });

    const showMore = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Show 12 more"
    );
    click(showMore || null);
    expect(container.querySelectorAll('[data-testid="profile-inventory-card"]')).toHaveLength(14);
    expect(container.textContent).toContain("Test Stone 14");
    expect(container.textContent).not.toContain("Show 12 more");

    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search by stone name"]'
    );
    changeInput(search, "Test Stone 14");
    expect(container.querySelectorAll('[data-testid="profile-inventory-card"]')).toHaveLength(1);
    expect(container.textContent).toContain("Test Stone 14");

    changeInput(search, "Unlisted Emerald");
    expect(container.textContent).toContain("No match for “Unlisted Emerald”");
    expect(container.textContent).toContain("JW Stone may be able to source it");
    expect(container.textContent).toContain("Request this stone");
  });

  it("applies the same Phase 2 UI contract to a non-JW profile slug", () => {
    const genericPresentation = {
      type: "profilePresentation",
      data: {
        inventory: {
          initialView: "catalog",
          density: "compact",
          pageSize: 12,
          pageStep: 12,
          stickyControls: true,
          sourceRequests: true,
        },
        audience: { layout: "guided" },
        faq: { layout: "disclosure" },
        recommendations: { initialLimit: 3, maxVisible: 24 },
      },
    };

    act(() => {
      root.render(
        <WholesalerProfileTheme
          {...props}
          profileSlug="sample-stone-supplier"
          displayName="Sample Stone Supplier"
          profileShareDestination="/u/sample-stone-supplier"
          contentBlocks={[
            genericPresentation,
            ...contentBlocks.filter((block) => block.type !== "profilePresentation"),
          ]}
        />
      );
    });

    expect(container.querySelector("#inventory-browser")).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="profile-inventory-card"]')).toHaveLength(12);
    expect(container.querySelector('[data-testid="profile-audience-chooser"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="profile-faq-item"]')).toHaveLength(2);
    expect(container.textContent).toContain("Recommendation 3");
    expect(container.textContent).not.toContain("Recommendation 4");

    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search by stone name"]'
    );
    changeInput(search, "Unlisted Emerald");
    expect(container.textContent).toContain(
      "Sample Stone Supplier may be able to source it for your project."
    );
  });

  it("preserves legacy wholesaler behavior when no presentation block opts in", () => {
    act(() => {
      root.render(
        <WholesalerProfileTheme
          {...props}
          profileSlug="legacy-stone-supplier"
          displayName="Legacy Stone Supplier"
          profileShareDestination="/u/legacy-stone-supplier"
          contentBlocks={contentBlocks.filter((block) => block.type !== "profilePresentation")}
        />
      );
    });

    expect(container.querySelector("#inventory-browser")).toBeNull();
    expect(container.querySelector('[data-testid="profile-audience-chooser"]')).toBeNull();
    expect(container.querySelectorAll("details")).toHaveLength(0);
    expect(container.textContent).toContain("Ask through Direct Connect.");
    expect(container.textContent).toContain("Recommendation 4");
    expect(
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "Show all 4 recommendations"
      )
    ).toBe(false);
  });
});
