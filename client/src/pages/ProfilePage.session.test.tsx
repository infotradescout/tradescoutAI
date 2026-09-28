/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const fixture = vi.hoisted(() => ({
  user: null as any,
  request: vi.fn(),
  refetch: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: fixture.user, refetch: fixture.refetch }),
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: fixture.request }));
vi.mock("wouter", () => ({ useLocation: () => ["/profile", fixture.navigate] }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: fixture.toast }) }));
vi.mock("@/lib/canonicalOrigin", () => ({
  getCanonicalAppOrigin: () => "https://synthetic.example",
}));
vi.mock("@/components/user-badges", () => ({
  UserBadges: ({ badges }: { badges: string[] }) => (
    <div data-testid="profile-badges">{badges.join(", ")}</div>
  ),
}));
vi.mock("@/lib/postOnboardingRoute", () => ({
  isBusinessUser: (user: any) => Boolean(user?.isBusiness),
}));

const user = (id: string, isBusiness = false) => ({
  id,
  firstName: `Synthetic ${id}`,
  email: `${id}@synthetic.example`,
  roles: [],
  badges: [],
  preferences: { profileVisibility: "private", badges: { show: true } },
  isBusiness,
});

const published = (id: string, slug: string) => [
  {
    id,
    slug,
    status: "published",
    publicExposure: { mode: "direct_only", reason: "synthetic_a_review" },
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("ProfilePage account session isolation", () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  async function render() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <ProfilePage />
        </QueryClientProvider>
      );
    });
  }

  beforeEach(() => {
    fixture.user = user("member-a");
    fixture.request.mockReset();
    fixture.refetch.mockReset();
    fixture.navigate.mockReset();
    fixture.toast.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it.each(["empty", "failed"])(
    "hides the former profile immediately and after the next account's %s lookup",
    async (outcome) => {
      const nextProfiles = deferred<unknown>();
      fixture.request.mockImplementation(async (_method: string, path: string) => {
        if (path === "/api/profiles")
          return fixture.user.id === "member-a"
            ? published("profile-a", "former-member-a")
            : nextProfiles.promise;
        if (path === "/api/xp/me")
          return {
            userId: fixture.user.id,
            xpTotal: fixture.user.id === "member-a" ? 98765 : 7,
            recentLedger: [],
          };
        if (path === "/api/badges/me")
          return {
            userId: fixture.user.id,
            labels: fixture.user.id === "member-a" ? ["Former Member Badge"] : [],
          };
        throw new Error(`Unexpected request ${path}`);
      });

      await render();
      expect(host.textContent).toContain("former-member-a");
      expect(host.textContent).toContain("Synthetic a review");
      expect(host.textContent).toContain("98765");
      expect(host.textContent).toContain("Former Member Badge");

      fixture.user = user("member-b");
      await render();
      expect(host.textContent).not.toContain("former-member-a");
      expect(host.textContent).not.toContain("Synthetic a review");
      expect(host.textContent).not.toContain("98765");
      expect(host.textContent).not.toContain("Former Member Badge");

      await act(async () => {
        if (outcome === "empty") nextProfiles.resolve([]);
        else nextProfiles.reject(new Error("Synthetic profile lookup unavailable"));
        await nextProfiles.promise.catch(() => undefined);
      });
      expect(host.textContent).not.toContain("former-member-a");
      expect(host.textContent).not.toContain("Synthetic a review");
    }
  );

  it("hides the former business page when the next member has no business", async () => {
    fixture.user = user("member-a", true);
    fixture.request.mockImplementation(async (method: string, path: string) => {
      if (method === "PATCH" && path === "/api/users/profile-visibility")
        return { profileSlug: null };
      if (path === "/api/business-profile/me")
        return { slug: "former-business-a", visibility: "public" };
      if (path === "/api/profiles") return [];
      if (path === "/api/xp/me") return { userId: fixture.user.id, xpTotal: 0, recentLedger: [] };
      if (path === "/api/badges/me") return { userId: fixture.user.id, labels: [] };
      throw new Error(`Unexpected request ${path}`);
    });
    await render();
    expect(host.textContent).toContain("former-business-a");
    expect(host.textContent).toContain("Enable Public Profile");
    const enableButton = Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Enable Public Profile")
    );
    expect(enableButton).toBeDefined();
    await act(async () => {
      enableButton?.click();
    });
    expect(fixture.request).toHaveBeenCalledWith("PATCH", "/api/users/profile-visibility", {
      profileVisibility: "public",
      proceedUnverified: true,
    });
    fixture.user = user("member-b");
    await render();
    expect(host.textContent).not.toContain("former-business-a");
    expect(host.textContent).not.toContain("Public Business Page");
  });

  it("does not apply a former member's late public-profile activation to the new session", async () => {
    const activation = deferred<{ profileSlug: string }>();
    fixture.request.mockImplementation(async (method: string, path: string) => {
      if (method === "PATCH" && path === "/api/users/profile-visibility") return activation.promise;
      if (path === "/api/profiles") return [];
      if (path === "/api/xp/me") return { userId: fixture.user.id, xpTotal: 0, recentLedger: [] };
      if (path === "/api/badges/me") return { userId: fixture.user.id, labels: [] };
      throw new Error(`Unexpected request ${path}`);
    });
    await render();
    await act(async () => {
      Array.from(host.querySelectorAll("button"))
        .find((button) => button.textContent?.includes("Enable Public Profile"))!
        .click();
    });
    fixture.user = user("member-b");
    await render();
    expect(
      Array.from(host.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Enable Public Profile")
      )?.disabled
    ).toBe(false);

    await act(async () => {
      activation.resolve({ profileSlug: "former-activation-a" });
    });
    expect(host.textContent).not.toContain("former-activation-a");
    expect(fixture.refetch).not.toHaveBeenCalled();
    expect(fixture.navigate).not.toHaveBeenCalled();
    expect(fixture.toast).not.toHaveBeenCalled();
  });
});
