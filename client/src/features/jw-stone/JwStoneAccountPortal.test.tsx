/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JW_STONE_PORTAL_COPY } from "@shared/jwStonePortalCopy";
import { MarketplaceHeader } from "./MarketplaceHeader";
import { PublicProfileAccountDialog } from "@/components/profile/PublicProfileAccountDialog";

const fixture = vi.hoisted(() => ({
  user: null as { id: string } | null,
  load: vi.fn(), create: vi.fn(), register: vi.fn(), refetch: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: fixture.user, isAuthenticated: !!fixture.user, refetch: fixture.refetch }) }));
vi.mock("@/components/profile/profileAccountClient", () => ({
  buildProfileAccountResumePath: (slug: string) => `/u/${slug}?profileAccount=1`,
  currentProfileAccountSourcePath: (slug: string) => `/u/${slug}`,
  loadProfileAccountState: fixture.load, createProfileAccount: fixture.create, registerProfileAccount: fixture.register,
  readProfileAccountJson: async (response: Response) => response.json(),
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  DialogDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
}));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const empty = { policy: { enabled: true, requiredIdentity: "business", includesBidRock: false }, account: null, viewerBusiness: null, requiresBusinessSetup: true, entitlements: [] };
const noPricePromotion = /pric(?:e|es|ing)|wholesale|discount|unlock|rate\b/i;
let host: HTMLDivElement, root: Root;
const renderAccount = async (slug = "jw-stone", mode: "create" | "signin" = "create") => {
  await act(async () => root.render(<PublicProfileAccountDialog open onOpenChange={vi.fn()} profileSlug={slug} profileName={slug === "jw-stone" ? "JW Stone Logistics" : "Sample Business"} initialMode={mode} />));
};
beforeEach(() => {
  fixture.user = null; fixture.load.mockReset().mockResolvedValue(empty); fixture.create.mockReset(); fixture.register.mockReset(); fixture.refetch.mockReset();
  window.history.replaceState(null, "", "/u/jw-stone");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

describe("JW Stone fabricator portal copy", () => {
  it("keeps every public copy string focused on business access, not protected benefits", () => {
    expect(Object.values(JW_STONE_PORTAL_COPY).join(" ")).not.toMatch(noPricePromotion);
    expect(JW_STONE_PORTAL_COPY.audience).toContain("businesses");
  });
  it.each([false, true])("labels the account entry for business visitors (hasAccount=%s)", async hasAccount => {
    const open = vi.fn();
    await act(async () => root.render(<MarketplaceHeader wishlistCount={0} hasAccount={hasAccount} onOpenWishlist={vi.fn()} onOpenAccount={open} onStartRequest={vi.fn()} />));
    const account = host.querySelector<HTMLButtonElement>('[data-testid="jw-marketplace-account-button"]')!;
    expect(account.textContent).toContain("Fabricator Portal"); expect(account.textContent).toContain("Business access");
    expect(account.getAttribute("aria-label")).toContain("Fabricator Portal");
    expect(host.textContent).not.toMatch(noPricePromotion);
    await act(async () => account.click()); expect(open).toHaveBeenCalledTimes(1);
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="jw-marketplace-menu-button"]')!.click());
    const menu = host.querySelector('[data-testid="jw-marketplace-menu-panel"]')!;
    expect(menu.textContent).toContain("Fabricator Portal"); expect(menu.textContent).toContain("Business access");
    await act(async () => menu.querySelector<HTMLButtonElement>("button")!.click()); expect(open).toHaveBeenCalledTimes(2);
  });
  it("explains the business audience before account state finishes loading", async () => {
    fixture.load.mockReturnValue(new Promise(() => {})); await renderAccount();
    expect(host.querySelector("h2")?.textContent).toBe("JW Stone Fabricator Portal");
    expect(host.textContent).toContain("For fabricators and stone-industry businesses.");
    expect(host.textContent).toContain("Opening Fabricator Portal"); expect(host.textContent).not.toMatch(noPricePromotion);
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("keeps the business-name requirement in the create form", async () => {
    await renderAccount();
    expect(host.querySelector('[data-testid="profile-account-business-name"]')).not.toBeNull();
    const submit = host.querySelector<HTMLButtonElement>('[data-testid="profile-account-submit"]')!;
    expect(submit.textContent).toBe("Create business account");
    await act(async () => submit.click());
    expect(host.textContent).toContain("Enter your business name."); expect(fixture.register).not.toHaveBeenCalled();
    expect(host.textContent).not.toMatch(noPricePromotion);
  });
  it("describes existing TradeScout sign-in without inventing a separate identity", async () => {
    await renderAccount("jw-stone", "signin");
    expect(host.textContent).toContain("Use your existing TradeScout account");
    expect(host.querySelector('[data-testid="profile-account-submit"]')?.textContent).toBe("Sign in and continue");
    expect(host.querySelector('input[autocomplete="current-password"]')).not.toBeNull();
    expect(host.textContent).not.toMatch(noPricePromotion);
  });
  it("uses neutral pending-verification text after connection", async () => {
    fixture.user = { id: "synthetic-member" };
    fixture.load.mockResolvedValue({ ...empty, account: { status: "active", businessName: "Synthetic Fabrication", verificationStatus: "pending" } });
    await renderAccount();
    expect(host.textContent).toContain("Synthetic Fabrication is connected to JW Stone Logistics.");
    expect(host.textContent).toContain(JW_STONE_PORTAL_COPY.pendingDescription);
    expect(host.textContent).not.toMatch(noPricePromotion); expect(fixture.create).not.toHaveBeenCalled();
  });
  it("still asks a signed-in individual for their business", async () => {
    fixture.user = { id: "synthetic-individual" }; await renderAccount();
    expect(host.querySelector('[data-testid="profile-account-business-name"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="profile-account-submit"]')?.textContent).toBe("Connect business account");
    expect(fixture.create).not.toHaveBeenCalled(); expect(host.textContent).not.toMatch(noPricePromotion);
  });
  it("does not relabel another business's universal account flow", async () => {
    await renderAccount("sample-business");
    expect(host.querySelector("h2")?.textContent).toBe("Create an account with Sample Business");
    expect(host.querySelector('[data-testid="profile-account-submit"]')?.textContent).toBe("Create account with Sample Business");
    expect(host.textContent).not.toContain("Fabricator Portal");
  });
  it("does not claim access after account lookup fails", async () => {
    fixture.load.mockRejectedValue(new Error("Account is temporarily unavailable.")); await renderAccount();
    expect(host.querySelector('[data-testid="profile-account-load-error"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="profile-account-dialog-connected"]')).toBeNull();
    expect(host.textContent).not.toMatch(noPricePromotion); expect(fixture.create).not.toHaveBeenCalled();
  });
});
