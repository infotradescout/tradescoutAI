// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { storeOutcomeOnboardingClaimContinuation } from "@/lib/outcomeOnboardingClaimContinuation";
import { ProtectedRoute } from "./ProtectedRoute";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({
  location: "/claim-my-business",
  navigate: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => [mocks.location, mocks.navigate] as const,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", role: "community_member", onboardingCompleted: false },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

describe("ProtectedRoute outcome-claim continuation", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    window.sessionStorage.clear();
    mocks.navigate.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderRoute() {
    await act(async () => {
      root.render(
        <ProtectedRoute>
          <div data-testid="claim-page">Claim page</div>
        </ProtectedRoute>
      );
      await Promise.resolve();
    });
  }

  it("does not bounce the exact session-scoped claim route", async () => {
    storeOutcomeOnboardingClaimContinuation({
      businessId: "directory-1",
      goal: "Build my profile",
      business: { name: "Acme Works" },
    });
    mocks.location = "/claim-my-business?source=outcome_onboarding_match&businessId=directory-1";

    await renderRoute();

    expect(container.querySelector('[data-testid="claim-page"]')).not.toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("still redirects an unscoped or mismatched claim route to universal onboarding", async () => {
    storeOutcomeOnboardingClaimContinuation({
      businessId: "directory-1",
      goal: "Build my profile",
      business: { name: "Acme Works" },
    });
    mocks.location =
      "/claim-my-business?source=outcome_onboarding_match&businessId=different-business";

    await renderRoute();

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/onboarding?next=%2Fclaim-my-business%3Fsource%3Doutcome_onboarding_match%26businessId%3Ddifferent-business"
    );
  });
});
