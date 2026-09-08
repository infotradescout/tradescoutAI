// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreScoutSetup from "./pre-scout-setup";
import {
  clearRecommendationDraft,
  readRecommendationDraft,
  saveRecommendationDraft,
} from "@/lib/recommendationDraft";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  user: null as any,
  navigate: vi.fn(),
  refetch: vi.fn(),
  apiRequest: vi.fn(),
  toast: vi.fn(),
  location: "/pre-scout-setup?mode=signin&next=%2Fdirect-connect%3Fcounty%3D22005",
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: state.user,
    isAuthenticated: Boolean(state.user),
    refetch: state.refetch,
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {}, refetchQueries: async () => {} }),
}));
vi.mock("wouter", () => ({
  useLocation: () => [state.location, state.navigate],
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: state.apiRequest }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/components/SEOHelmet", () => ({ SEOHelmet: () => null }));
vi.mock("@/components/state-county-selector", () => ({ StateCountySelector: () => null }));
vi.mock("@/components/GooglePlacesLocationInput", () => ({
  GooglePlacesLocationInput: () => null,
}));
vi.mock("@/components/GooglePlacesBusinessInput", () => ({
  GooglePlacesBusinessInput: () => null,
}));
vi.mock("@/lib/demandEngine", () => ({
  bootstrapDemandAttribution: vi.fn(),
  trackDemandEvent: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackShellEvent: vi.fn() }));

beforeEach(() => {
  state.user = null;
  state.location = "/pre-scout-setup?mode=signin&next=%2Fdirect-connect%3Fcounty%3D22005";
  state.refetch.mockReset().mockResolvedValue({});
  state.apiRequest.mockReset().mockResolvedValue({});
  state.toast.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function fillRecommendationAccount(container: HTMLElement) {
  for (const [selector, value] of [
    ['[name="firstName"]', "A Neighbor"],
    ['[name="email"]', "neighbor@example.test"],
    ['[name="password"]', "synthetic-password"],
  ]) {
    const input = container.querySelector<HTMLInputElement>(selector)!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await act(async () =>
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
  );
}

describe("sign-in route ownership", () => {
  it("refreshes the guest auth cache after delayed recommendation signup establishes its session", async () => {
    const recommendationPath = "/u/acme-repair?trustAction=recommend";
    state.location = `/pre-scout-setup?mode=create&next=${encodeURIComponent(recommendationPath)}`;
    window.history.replaceState({}, "", state.location);
    state.apiRequest.mockResolvedValue({ emailVerificationRequired: true });
    let polls = 0;
    let sessionEstablished = false;
    const refreshedAfterEstablished: boolean[] = [];
    const registeredUser = { id: "reviewer", onboardingCompleted: false, emailVerified: false };
    state.refetch.mockImplementation(async () => {
      refreshedAfterEstablished.push(sessionEstablished);
      state.user = sessionEstablished ? registeredUser : null;
      return { data: state.user };
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).endsWith("/api/auth/user")) {
          polls += 1;
          sessionEstablished = polls >= 2;
          return {
            ok: sessionEstablished,
            json: async () => ({
              authenticated: sessionEstablished,
              user: sessionEstablished ? registeredUser : null,
            }),
          };
        }
        return { ok: true, json: async () => ({ google: true, facebook: true }) };
      })
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<PreScoutSetup />));
      await fillRecommendationAccount(container);
      vi.useFakeTimers();
      await act(async () =>
        container
          .querySelector("form")!
          .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      );
      await act(async () => vi.runAllTimersAsync());
      expect(polls).toBe(2);
      expect(refreshedAfterEstablished).toEqual([true]);
      expect(state.user).toEqual(registeredUser);
      await act(async () => root.render(<PreScoutSetup />));
      expect(state.navigate).toHaveBeenLastCalledWith(recommendationPath);
      expect(
        state.navigate.mock.calls.some(([path]) => String(path).startsWith("/onboarding"))
      ).toBe(false);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("offers sign-in recovery with the exact recommendation when signup cannot establish a session", async () => {
    const recommendationPath = "/u/acme-repair?trustAction=recommend";
    state.location = `/pre-scout-setup?mode=create&next=${encodeURIComponent(recommendationPath)}`;
    window.history.replaceState({}, "", state.location);
    const savedDraft = {
      version: 1 as const,
      contractorId: "contractor-recovery",
      ownerUserId: null,
      savedAt: Date.now(),
      readyToSubmit: true,
      data: {
        submissionId: "8a49f6a5-4ec8-4849-ac60-9f75f3b1876a",
        recommendationType: "positive" as const,
        comment: "My private recommendation is ready to save after sign-in.",
      },
    };
    expect(saveRecommendationDraft(window.localStorage, savedDraft)).toBe(true);
    state.apiRequest.mockResolvedValue({ emailVerificationRequired: true });
    let polls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).endsWith("/api/auth/user")) {
          polls += 1;
          return { ok: false, json: async () => ({ authenticated: false }) };
        }
        return { ok: true, json: async () => ({ google: true, facebook: true }) };
      })
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<PreScoutSetup />));
      await fillRecommendationAccount(container);
      vi.useFakeTimers();
      await act(async () =>
        container
          .querySelector("form")!
          .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      );
      await act(async () => vi.runAllTimersAsync());
      expect(polls).toBe(6);
      expect(state.refetch).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="signup-error"]')?.textContent).toContain(
        "Your account was created, but sign-in could not be confirmed."
      );
      expect(state.navigate).not.toHaveBeenCalled();
      expect(state.toast.mock.calls.some(([payload]) => payload.title === "Account created")).toBe(
        false
      );
      const recovery = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent === "Sign in to continue"
      );
      expect(recovery).toBeTruthy();
      await act(async () => recovery!.click());
      expect(new URL(window.location.href).searchParams.get("next")).toBe(recommendationPath);
      expect(new URL(window.location.href).searchParams.get("mode")).toBe("signin");
      expect(container.querySelector<HTMLInputElement>('[data-testid="login-email"]')?.value).toBe(
        "neighbor@example.test"
      );
      expect(readRecommendationDraft(window.localStorage, savedDraft.contractorId, null)).toEqual(
        savedDraft
      );
    } finally {
      await act(async () => root.unmount());
      clearRecommendationDraft(window.localStorage, savedDraft.contractorId, null);
      container.remove();
    }
  });

  it("does not report sign-in success while the account probe remains unauthenticated", async () => {
    const recommendationPath = "/u/acme-repair?trustAction=recommend";
    state.location = `/pre-scout-setup?mode=signin&next=${encodeURIComponent(recommendationPath)}`;
    window.history.replaceState({}, "", state.location);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) =>
        String(url).endsWith("/api/auth/user")
          ? { ok: false, json: async () => ({ authenticated: false }) }
          : { ok: true, json: async () => ({ google: true, facebook: true }) }
      )
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<PreScoutSetup />));
      for (const [selector, value] of [
        ['[data-testid="login-email"]', "neighbor@example.test"],
        ['[data-testid="login-password"]', "synthetic-password"],
      ]) {
        const input = container.querySelector<HTMLInputElement>(selector)!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
            input,
            value
          );
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      vi.useFakeTimers();
      await act(async () =>
        container
          .querySelector("form")!
          .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      );
      await act(async () => vi.runAllTimersAsync());
      expect(state.refetch).not.toHaveBeenCalled();
      expect(container.textContent).toContain("Sign-in could not be confirmed.");
      expect(state.toast.mock.calls.some(([payload]) => payload.title === "Signed in")).toBe(false);
      expect(state.navigate).not.toHaveBeenCalled();
      expect(new URL(window.location.href).searchParams.get("next")).toBe(recommendationPath);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("creates a recommendation account with name, email, password and terms, then resumes the action", async () => {
    const recommendationPath = "/u/acme-repair?trustAction=recommend";
    state.location = `/pre-scout-setup?mode=create&next=${encodeURIComponent(recommendationPath)}`;
    state.apiRequest.mockResolvedValue({ emailVerificationRequired: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          authenticated: true,
          google: true,
          facebook: true,
          user: { id: "reviewer" },
        }),
      }))
    );
    window.history.replaceState(
      {},
      "",
      `/pre-scout-setup?mode=create&next=${encodeURIComponent(recommendationPath)}`
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<PreScoutSetup />));
      expect(container.textContent).toContain("Save your recommendation to your account.");
      expect(container.querySelector('[name="lastName"]')).toBeNull();
      expect(container.querySelector('[name="phone"]')).toBeNull();
      expect(container.querySelector('[name="confirmPassword"]')).toBeNull();
      expect(container.querySelectorAll('input[type="password"]')).toHaveLength(1);
      const google =
        container.querySelector<HTMLAnchorElement>('[data-testid="signup-google"]') ||
        container.querySelector<HTMLAnchorElement>('a[href*="/api/auth/google"]');
      expect(google).not.toBeNull();
      expect(new URL(google!.href).searchParams.get("next")).toBe(recommendationPath);

      for (const [selector, value] of [
        ['[name="firstName"]', "A Neighbor"],
        ['[name="email"]', "neighbor@example.test"],
        ['[name="password"]', "synthetic-password"],
      ]) {
        const input = container.querySelector<HTMLInputElement>(selector)!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
            input,
            value
          );
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      }
      await act(async () =>
        container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
      );
      await act(async () =>
        container
          .querySelector("form")!
          .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      );
      expect(state.apiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/auth/register",
        expect.objectContaining({
          firstName: "A Neighbor",
          email: "neighbor@example.test",
          password: "synthetic-password",
          next: recommendationPath,
          acceptTerms: true,
        })
      );
      expect(
        state.navigate.mock.calls.some(([path]) => String(path).startsWith("/check-email"))
      ).toBe(false);

      state.user = { id: "reviewer", onboardingCompleted: false, emailVerified: false };
      await act(async () => root.render(<PreScoutSetup />));
      expect(state.navigate).toHaveBeenLastCalledWith(recommendationPath);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("keeps normal account registration fields for unrelated destinations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) }))
    );
    window.history.replaceState({}, "", "/pre-scout-setup?mode=create&next=%2Fdirect-connect");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(<PreScoutSetup />));
      expect(container.querySelector('[name="lastName"]')).not.toBeNull();
      expect(container.querySelector('[name="phone"]')).not.toBeNull();
      expect(container.querySelector('[name="confirmPassword"]')).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it.each([
    ["AUTH_ACCOUNT_LINK_REQUIRED", "That email already belongs to an account."],
    ["AUTH_IDENTITY_COLLISION", "We found conflicting account records."],
  ])(
    "renders %s on the existing sign-in surface while retaining the request destination",
    async (code, message) => {
      state.user = null;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({ ok: true, json: async () => ({ google: true, facebook: true }) }))
      );
      window.history.replaceState(
        {},
        "",
        `/pre-scout-setup?mode=create&next=%2Fdirect-connect%3Fcounty%3D22005&oauthError=${code}`
      );
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      try {
        await act(async () => root.render(<PreScoutSetup />));
        expect(container.textContent).toContain(message);
        expect(container.textContent).toContain("no accounts were linked or changed");
        expect(container.querySelectorAll('input[type="password"]')).toHaveLength(1);
        expect(container.textContent).toContain("Your request draft is safe.");
        const google = container.querySelector<HTMLAnchorElement>('[data-testid="login-google"]');
        expect(google).not.toBeNull();
        expect(new URL(google!.href).searchParams.get("next")).toContain(
          "next=%2Fdirect-connect%3Fcounty%3D22005"
        );
      } finally {
        await act(async () => root.unmount());
        container.remove();
      }
    }
  );

  it.each([true, false])(
    "uses refreshed onboarding completion (%s) after a delayed sign-in handler resumes",
    async (completed) => {
      state.user = null;
      let finishRefetch!: () => void;
      state.refetch.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishRefetch = resolve;
          })
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ authenticated: true, user: { id: "requester" } }),
        }))
      );
      window.history.replaceState(
        {},
        "",
        "/pre-scout-setup?mode=signin&next=%2Fdirect-connect%3Fcounty%3D22005"
      );
      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      try {
        await act(async () => root.render(<PreScoutSetup />));
        for (const [selector, value] of [
          ["input[type=email]", "requester@example.test"],
          ["input[type=password]", "synthetic-password"],
        ]) {
          const input = container.querySelector<HTMLInputElement>(selector)!;
          expect(input).toBeTruthy();
          await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
              input,
              value
            );
            input.dispatchEvent(new Event("input", { bubbles: true }));
          });
        }
        await act(async () => {
          container
            .querySelector("form")!
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        expect(state.refetch).toHaveBeenCalled();
        state.user = { id: "requester", onboardingCompleted: completed };
        await act(async () => root.render(<PreScoutSetup />));
        const expected = completed
          ? "/direct-connect?county=22005"
          : "/onboarding?next=%2Fdirect-connect%3Fcounty%3D22005";
        expect(state.navigate).toHaveBeenLastCalledWith(expected);
        await act(async () => finishRefetch());
        expect(state.navigate).toHaveBeenLastCalledWith(expected);
        expect(state.navigate.mock.calls.every(([path]) => path === expected)).toBe(true);
      } finally {
        await act(async () => root.unmount());
        container.remove();
      }
    }
  );
});
