// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ISSA_BUILD_PROFILE_CONTENT_BLOCKS } from "@shared/issaBuildProfile";
import WholesalerProfileTheme from "./WholesalerProfileTheme";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("wouter", () => ({
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useLocation: () => ["/u/issa-build", vi.fn()],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

vi.mock("@/utils/share", () => ({
  inferShareKind: () => "profile",
  share: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./ExpressDirectConnectPanel", () => ({
  default: (props: any) =>
    props.open ? (
      <div
        data-testid="request-recipient"
        data-profile={props.profileSlug}
        data-service={props.initialServiceName}
        data-mode={props.requestMode}
      />
    ) : null,
}));

const FORBIDDEN_INVENTORY_CHROME = [
  "profile-inventory-card",
  "jw-stone-inventory-card",
  "Search by stone name",
  "Current collection",
  "View details",
  "Featured stones",
  "Browse full inventory",
  "Material to confirm",
  "slab count",
  "bundle count",
];

const baseProps = {
  profileSlug: "issa-build",
  displayName: "ISSA Build",
  businessAddress: null,
  headline: "Crafted for light.",
  categories: ["Onyx"],
  serviceAreas: [] as string[],
  hasViewerSession: false,
  isSuperAdminViewer: false,
  useExpressDirectConnect: true,
  allowExpressCall: false,
  profileShareDestination: "/u/issa-build",
  tradeScoutReturnHref: "/",
  directConnectHref: "/direct-connect",
  preScoutCreateHref: "/pre-scout-setup?mode=create",
  preScoutSignInHref: "/pre-scout-setup?mode=signin",
  trustActions: <div data-testid="profile-trust-section">Trust</div>,
};

describe("WholesalerProfileTheme lux fail-closed", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders luxury house and never inventory chrome when inventoryCatalog is missing", () => {
    const contentBlocks: Array<{ type: string; data: Record<string, unknown> }> =
      ISSA_BUILD_PROFILE_CONTENT_BLOCKS.filter((block) => block.type !== "inventoryCatalog").map(
        (block) => ({
          type: block.type,
          data: { ...(block.data as Record<string, unknown>) },
        })
      );

    expect(contentBlocks.some((block) => block.type === "inventoryCatalog")).toBe(false);
    expect(contentBlocks.some((block) => block.type === "premiumProduct")).toBe(true);

    act(() => {
      root.render(<WholesalerProfileTheme {...baseProps} contentBlocks={contentBlocks} />);
    });

    expect(
      container.querySelector('[data-testid="luxury-material-house-showcase"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="luxury-material-house-unavailable"]')).toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("Kitchens, bathrooms and stone.");
    expect(container.textContent).toContain("Pensacola and surrounding areas");
    expect(
      container.querySelectorAll('nav[aria-label="ISSA Build Pensacola services"] a')
    ).toHaveLength(5);
    const generalRequest = Array.from(container.querySelectorAll("button")).find(
      (button) =>
        button.textContent?.trim() === "Start a Request" &&
        !button.closest('[data-testid="issa-build-verification-band"]')
    );
    expect(generalRequest).toBeTruthy();
    act(() => generalRequest?.click());
    const recipient = container.querySelector('[data-testid="request-recipient"]');
    expect(recipient?.getAttribute("data-profile")).toBe("issa-build");
    expect(recipient?.getAttribute("data-service")).toBe("Kitchen and bathroom project");
    expect(recipient?.getAttribute("data-mode")).toBe("service");
    const footer = container.querySelector('[data-testid="wholesaler-brand-footer"]');
    const poweredLink = footer?.querySelector<HTMLAnchorElement>("a");
    expect(footer?.querySelectorAll("a")).toHaveLength(1);
    expect(poweredLink?.textContent?.trim()).toBe("Powered by TradeScout");
    expect(poweredLink?.getAttribute("href")).toBe("/");

    const text = (container.textContent || "").toLowerCase();
    const html = container.innerHTML.toLowerCase();
    for (const forbidden of FORBIDDEN_INVENTORY_CHROME) {
      expect(text).not.toContain(forbidden.toLowerCase());
      expect(html).not.toContain(forbidden.toLowerCase());
    }
  });

  it("fails closed to unavailable state when luxuryHouse payload is missing", () => {
    const contentBlocks = [
      {
        type: "premiumProduct",
        data: {
          variant: "editorial-product",
          presentation: "lux",
          // Intentionally incomplete — must not fall through to inventory chrome.
        },
      },
      {
        type: "inventoryCatalog",
        data: {
          title: "Should not render",
          categories: [
            {
              category: "Onyx",
              categorySlug: "onyx",
              stones: [
                {
                  name: "Trap Stone",
                  slug: "trap-stone",
                  images: ["/images/businesses/issa-build/applications/01.jpg"],
                },
              ],
            },
          ],
        },
      },
    ];

    act(() => {
      root.render(<WholesalerProfileTheme {...baseProps} contentBlocks={contentBlocks} />);
    });

    expect(
      container.querySelector('[data-testid="luxury-material-house-unavailable"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="luxury-material-house-showcase"]')).toBeNull();
    expect(container.querySelector('[data-testid="profile-inventory-card"]')).toBeNull();
    expect(container.textContent).not.toContain("Search by stone name");
    expect(container.textContent).not.toContain("Browse full inventory");
    expect(container.textContent).not.toContain("Trap Stone");
  });
});
