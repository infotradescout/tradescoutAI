// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({
  location: "/admin/moderation",
  navigate: vi.fn(),
  user: {
    id: "moderator-1",
    role: "moderator",
    roles: ["moderator"],
    onboardingCompleted: true,
  } as Record<string, unknown>,
}));

vi.mock("wouter", () => ({
  useLocation: () => [mocks.location, mocks.navigate] as const,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

describe("ProtectedRoute moderator admin access", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.location = "/admin/moderation";
    mocks.user = {
      id: "moderator-1",
      role: "moderator",
      roles: ["moderator"],
      onboardingCompleted: true,
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderAdminOnlyRoute() {
    await act(async () => {
      root.render(
        <ProtectedRoute adminOnly>
          <div data-testid="moderation-tools">Moderation tools</div>
        </ProtectedRoute>
      );
      await Promise.resolve();
    });
  }

  it("allows a moderator through the admin shell gate", async () => {
    await renderAdminOnlyRoute();

    expect(container.querySelector('[data-testid="moderation-tools"]')).not.toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("still denies a regular authenticated user", async () => {
    mocks.user = {
      id: "member-1",
      role: "homeowner",
      roles: ["homeowner"],
      onboardingCompleted: true,
    };

    await renderAdminOnlyRoute();

    expect(container.querySelector('[data-testid="moderation-tools"]')).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith("/unauthorized");
  });
});
