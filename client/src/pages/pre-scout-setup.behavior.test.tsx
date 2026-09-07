// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import PreScoutSetup from "./pre-scout-setup";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  user: null as any,
  navigate: vi.fn(),
  refetch: vi.fn(),
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
  useLocation: () => [
    "/pre-scout-setup?mode=signin&next=%2Fdirect-connect%3Fcounty%3D22005",
    state.navigate,
  ],
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: async () => ({}) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("sign-in route ownership", () => {
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
