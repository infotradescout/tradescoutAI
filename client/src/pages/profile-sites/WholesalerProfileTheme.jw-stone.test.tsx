// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

    expect(container.querySelector("#inventory-browser")).not.toBeNull();
    expect(container.querySelector('button[aria-label="Back within JW Stone"]')).not.toBeNull();
    expect(container.querySelector('input[placeholder="Search by stone name"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="jw-stone-inventory-card"]')).toHaveLength(12);
    expect(
      container.querySelectorAll('[data-testid="jw-stone-featured-product-card"]')
    ).toHaveLength(0);
    const showMoreInventory = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Show 12 more"
    );
    click(showMoreInventory || null);
    expect(container.querySelectorAll('[data-testid="jw-stone-inventory-card"]')).toHaveLength(14);
    expect(container.querySelectorAll("details")).toHaveLength(2);
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
      container.querySelectorAll('[data-testid="jw-stone-featured-product-card"]')
    ).toHaveLength(3);
    const reopenInventory = Array.from(container.querySelectorAll("#collection button")).find(
      (button) => button.textContent?.includes("Browse full inventory")
    );
    click(reopenInventory || null);
    expect(container.querySelector("#inventory-browser")).not.toBeNull();
  });

  it("adapts guidance and Direct Connect intent to the selected customer type", () => {
    act(() => {
      root.render(<WholesalerProfileTheme {...props} />);
    });

    const chooser = container.querySelector('[data-testid="jw-stone-audience-chooser"]');
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
    expect(container.querySelectorAll('[data-testid="jw-stone-inventory-card"]')).toHaveLength(14);
    expect(container.textContent).toContain("Test Stone 14");
    expect(container.textContent).not.toContain("Show 12 more");

    const search = container.querySelector<HTMLInputElement>(
      'input[placeholder="Search by stone name"]'
    );
    changeInput(search, "Test Stone 14");
    expect(container.querySelectorAll('[data-testid="jw-stone-inventory-card"]')).toHaveLength(1);
    expect(container.textContent).toContain("Test Stone 14");

    changeInput(search, "Unlisted Emerald");
    expect(container.textContent).toContain("No match for “Unlisted Emerald”");
    expect(container.textContent).toContain("JW Stone may be able to source it");
    expect(container.textContent).toContain("Request this stone");
  });
});
