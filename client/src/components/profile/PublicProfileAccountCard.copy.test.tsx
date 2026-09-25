// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicProfileAccountCard } from "./PublicProfileAccountCard";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const auth = vi.hoisted(() => ({
  user: { id: "viewer-1" } as { id: string } | null,
  isAuthenticated: true,
  isLoading: false,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const profileName = "Maricopa Plumbing";
const profileSlug = "maricopa-plumbing";
const policy = (requiredIdentity: "user" | "business") => ({
  enabled: true,
  profileSlug,
  requiredIdentity,
  includesBidRock: false,
  priorityKey: "profile_account",
  label: "Account",
  heading: "Create an account",
  description: "Browse local work with this profile.",
});
let accountResponse: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;
let host: HTMLDivElement;
let root: Root;

async function renderCard() {
  await act(async () => {
    root.render(<PublicProfileAccountCard profileSlug={profileSlug} profileName={profileName} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  auth.user = { id: "viewer-1" };
  auth.isAuthenticated = true;
  auth.isLoading = false;
  accountResponse = {
    policy: policy("user"),
    viewerBusiness: null,
    requiresBusinessSetup: false,
    account: null,
    entitlements: [],
  };
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => accountResponse,
  }));
  vi.stubGlobal("fetch", fetchMock);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("public profile account copy", () => {
  it("tells a signed-in viewer that their existing TradeScout account links to this profile without contact", async () => {
    await renderCard();

    expect(host.querySelector("h3")?.textContent).toBe("Connect your TradeScout account");
    expect(host.textContent).toContain(`Link your existing TradeScout account to ${profileName}.`);
    expect(host.textContent).toContain("This does not send a request or message.");
    expect(host.querySelector('[data-testid="profile-account-create"]')?.textContent).toContain("Connect my account");
    expect(host.textContent).not.toContain("Create an account");

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="profile-account-create"]')?.click();
    });
    const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0][0]).toBe(`/api/u/${profileSlug}/account`);
  });

  it("names the existing business identity when a signed-in viewer can connect it", async () => {
    accountResponse = {
      ...accountResponse,
      policy: policy("business"),
      viewerBusiness: { id: "business-1", name: "Viewer Plumbing", verificationStatus: "approved" },
    };
    await renderCard();

    expect(host.querySelector("h3")?.textContent).toBe("Connect your business");
    expect(host.textContent).toContain(`Link Viewer Plumbing to ${profileName} using your existing TradeScout account.`);
    expect(host.textContent).toContain("This does not send a request or message.");
    expect(host.querySelector('[data-testid="profile-account-create"]')?.textContent).toContain("Connect my business");
    expect(host.textContent).not.toContain("Create an account");
  });

  it("calls for business setup when this profile requires a business identity", async () => {
    accountResponse = { ...accountResponse, policy: policy("business"), requiresBusinessSetup: true };
    await renderCard();

    expect(host.querySelector("h3")?.textContent).toBe("Set up your business");
    expect(host.textContent).toContain(`Add your business name to connect with ${profileName} using your existing TradeScout account.`);
    expect(host.querySelector('[data-testid="profile-account-create"]')?.textContent).toContain("Continue business setup");
    expect(host.textContent).not.toContain("Create an account");

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-testid="profile-account-create"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[data-testid="profile-account-dialog"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="profile-account-business-name"]')).not.toBeNull();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
  });

  it("keeps the signup language and profile policy description for an anonymous viewer", async () => {
    auth.user = null;
    auth.isAuthenticated = false;
    await renderCard();

    expect(host.querySelector("h3")?.textContent).toBe("Create an account");
    expect(host.textContent).toContain("Browse local work with this profile.");
    expect(host.querySelector('[data-testid="profile-account-create"]')?.textContent).toContain("Create an account");
  });

  it("does not flash signup language while the viewer session is being checked", async () => {
    auth.user = null;
    auth.isAuthenticated = false;
    auth.isLoading = true;
    await renderCard();

    expect(host.querySelector("h3")?.textContent).toBe("Checking your account");
    expect(host.querySelector('[data-testid="profile-account-create"]')).toBeNull();
    auth.user = { id: "viewer-1" };
    auth.isAuthenticated = true;
    auth.isLoading = false;
    await renderCard();
    expect(host.querySelector("h3")?.textContent).toBe("Connect your TradeScout account");
  });
});
