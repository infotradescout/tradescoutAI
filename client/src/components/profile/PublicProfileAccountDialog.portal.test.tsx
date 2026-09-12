/** @vitest-environment jsdom */
import { act, type PropsWithChildren, type HTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicProfileAccountDialog } from "./PublicProfileAccountDialog";
import { MarketplaceHeader } from "@/features/jw-stone/MarketplaceHeader";
import { JW_STONE_PORTAL_COPY } from "@shared/jwStonePortalCopy";

const fixture = vi.hoisted(() => ({
  viewer: null as { id: string } | null, authenticated: false,
  load: vi.fn(), create: vi.fn(), register: vi.fn(), refetch: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: fixture.viewer, isAuthenticated: fixture.authenticated, refetch: fixture.refetch }) }));
vi.mock("./profileAccountClient", async importOriginal => ({
  ...await importOriginal<typeof import("./profileAccountClient")>(),
  loadProfileAccountState: fixture.load, createProfileAccount: fixture.create, registerProfileAccount: fixture.register,
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: PropsWithChildren<{ open: boolean }>) => open ? <div>{children}</div> : null,
  DialogContent: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  DialogDescription: (props: HTMLAttributes<HTMLParagraphElement>) => <p {...props} />,
  DialogHeader: ({ children }: PropsWithChildren) => <header>{children}</header>,
  DialogTitle: (props: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props} />,
}));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const unconnected = { policy: { enabled: true, requiredIdentity: "business", includesBidRock: false }, viewerBusiness: null, requiresBusinessSetup: true, account: null, entitlements: [] };
let host: HTMLDivElement, root: Root;
const close = vi.fn();
const noPromotion = () => expect(host.textContent).not.toMatch(/\b(?:prices?|pricing|wholesale|discounts?|unlock(?:s|ed)?|rates?)\b/i);
async function render(node: ReactNode) { await act(async () => root.render(node)); }
async function dialog(slug = "jw-stone", mode: "create" | "signin" = "create") {
  await render(<PublicProfileAccountDialog open onOpenChange={close} profileSlug={slug} profileName={slug === "jw-stone" ? "JW Stone" : "Example Supplier"} initialMode={mode} />);
}
beforeEach(() => {
  window.history.replaceState(null, "", "/u/jw-stone");
  fixture.viewer = null; fixture.authenticated = false;
  fixture.load.mockReset().mockResolvedValue(unconnected);
  fixture.create.mockReset(); fixture.register.mockReset(); fixture.refetch.mockReset(); close.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe("JW Stone business membership language", () => {
  it("keeps every public copy variant free of pricing inducements", () => {
    expect(Object.values(JW_STONE_PORTAL_COPY).join(" ")).not.toMatch(/\b(?:prices?|pricing|wholesale|discounts?|unlock(?:s|ed)?|rates?)\b/i);
  });
  it("explains the business audience before any account lookup completes", async () => {
    fixture.load.mockImplementation(() => new Promise(() => {}));
    await dialog();
    expect(host.querySelector("h2")?.textContent).toBe("Create a JW Stone business membership");
    expect(host.textContent).toContain("For stone fabricators and industry businesses.");
    expect(host.textContent).toContain("Opening the Fabricator Portal"); noPromotion();
    expect(fixture.register).not.toHaveBeenCalled();
  });
  it("labels new membership creation and preserves business-name validation", async () => {
    await dialog();
    expect(host.querySelector('[data-testid="profile-account-submit"]')?.textContent).toBe("Create business membership");
    expect(host.querySelector('[data-testid="profile-account-business-name"]')).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="profile-account-submit"]')!.click());
    expect(host.textContent).toContain("Enter your business name.");
    expect(fixture.register).not.toHaveBeenCalled(); noPromotion();
  });
  it("keeps TradeScout sign-in and recovery available under the business portal title", async () => {
    await dialog("jw-stone", "signin");
    expect(host.querySelector("h2")?.textContent).toBe("Sign in to the JW Stone Fabricator Portal");
    expect(host.textContent).toContain("Use your existing TradeScout account");
    expect(host.textContent).toContain("Sign in and continue");
    expect(host.textContent).toContain("New here? Create a business membership");
    expect(host.querySelector('a[href^="/reset-password?"]')).not.toBeNull(); noPromotion();
  });
  it("uses business membership setup for an existing TradeScout user, without changing eligibility", async () => {
    fixture.viewer = { id: "existing-user" }; fixture.authenticated = true;
    await dialog();
    expect(host.querySelector("h2")?.textContent).toBe("Set up your JW Stone business membership");
    expect(host.querySelector('[data-testid="profile-account-submit"]')?.textContent).toBe("Continue with my business");
    expect(fixture.create).not.toHaveBeenCalled(); noPromotion();
  });
  it.each(["active", "revoked"])("does not advertise prices in connected membership copy when entitlement is %s", async entitlement => {
    fixture.viewer = { id: "business-user" }; fixture.authenticated = true;
    fixture.load.mockResolvedValue({ ...unconnected, requiresBusinessSetup: false,
      viewerBusiness: { id: "business", name: "Synthetic Fabricator", verificationStatus: "pending" },
      account: { id: "membership", status: "active", businessName: "Synthetic Fabricator", verificationStatus: "pending" },
      entitlements: [{ productKey: "jw_stone_member_pricing", status: entitlement }],
    });
    await dialog();
    expect(host.querySelector("h2")?.textContent).toBe("JW Stone Fabricator Portal");
    expect(host.textContent).toContain("Your JW Stone business membership is active.");
    expect(host.textContent).toContain("Your business verification is pending.");
    expect(fixture.create).not.toHaveBeenCalled(); noPromotion();
  });
  it("retains portal identity and retry when lookup fails", async () => {
    fixture.load.mockRejectedValue(new Error("Account is temporarily unavailable.")); await dialog();
    expect(host.querySelector("h2")?.textContent).toBe("Create a JW Stone business membership");
    expect(host.querySelector('[data-testid="profile-account-load-error"]')).not.toBeNull(); noPromotion();
  });
  it("does not relabel another supplier's universal account flow", async () => {
    await dialog("example-supplier");
    expect(host.querySelector("h2")?.textContent).toBe("Create an account with Example Supplier");
    expect(host.querySelector('[data-testid="profile-account-submit"]')?.textContent).toBe("Create account with Example Supplier");
    expect(host.textContent).not.toContain("Fabricator Portal");
  });
});
describe("JW Stone portal navigation", () => {
  it.each([false, true])("uses the portal label in header and menu for authenticated=%s", async hasAccount => {
    const open = vi.fn();
    await render(<MarketplaceHeader wishlistCount={0} hasAccount={hasAccount} onOpenAccount={open} onOpenWishlist={vi.fn()} onStartRequest={vi.fn()} />);
    const entry = host.querySelector<HTMLButtonElement>('[data-testid="jw-marketplace-account-button"]')!;
    expect(entry.textContent).toBe("Fabricator Portal");
    expect(entry.getAttribute("aria-label")).toContain("JW Stone Fabricator Portal");
    await act(async () => entry.click()); expect(open).toHaveBeenCalledTimes(1);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="jw-marketplace-menu-button"]')!.click());
    const menu = host.querySelector('[data-testid="jw-marketplace-menu-panel"]')!;
    expect(menu.textContent).toContain("Fabricator Portal");
    await act(async () => menu.querySelector<HTMLButtonElement>("button")!.click());
    expect(open).toHaveBeenCalledTimes(2); noPromotion();
  });
});
