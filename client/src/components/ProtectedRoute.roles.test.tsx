// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "./ProtectedRoute";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as any,
    isAuthenticated: true,
    isLoading: false,
  },
  location: "/professional-tool",
  navigate: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => [mocks.location, mocks.navigate] as const,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mocks.auth,
}));

describe("ProtectedRoute assigned-role authority", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.location = "/professional-tool";
    mocks.auth.user = {
      id: "user-1",
      role: "homeowner",
      roles: ["homeowner"],
      onboardingCompleted: true,
    };
    mocks.auth.isAuthenticated = true;
    mocks.auth.isLoading = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderRoute(options: { requiredRoles?: string[]; adminOnly?: boolean } = {}) {
    await act(async () => {
      root.render(
        <ProtectedRoute {...options}>
          <div data-testid="protected-content">Protected content</div>
        </ProtectedRoute>
      );
      await Promise.resolve();
    });
  }

  it("accepts an exact assigned role from the roles array", async () => {
    mocks.auth.user.roles = ["homeowner", null, { role: "realtor" }, "realtor"];

    await renderRoute({ requiredRoles: ["realtor"] });

    expect(container.querySelector('[data-testid="protected-content"]')).not.toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("does not implicitly promote a legacy car-sales alias to the approved canonical role", async () => {
    mocks.auth.user.roles = ["homeowner", "car_salesman"];

    await renderRoute({ requiredRoles: ["car_dealer"] });

    expect(container.querySelector('[data-testid="protected-content"]')).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith("/unauthorized");
  });

  it("preserves the existing admin bypass for role-gated routes", async () => {
    mocks.auth.user.roles = ["homeowner", "ops_admin"];

    await renderRoute({ requiredRoles: ["realtor"] });

    expect(container.querySelector('[data-testid="protected-content"]')).not.toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("does not let a professional role satisfy an admin-only route", async () => {
    mocks.auth.user.role = "realtor";
    mocks.auth.user.roles = ["realtor"];

    await renderRoute({ adminOnly: true });

    expect(container.querySelector('[data-testid="protected-content"]')).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith("/unauthorized");
  });

  it.each(["hoa_admin", "assistant_admin", "organization_admin"])(
    "does not infer admin authority from %s",
    async (role) => {
      mocks.auth.user.role = role;
      mocks.auth.user.roles = [role];

      await renderRoute({ adminOnly: true });

      expect(container.querySelector('[data-testid="protected-content"]')).toBeNull();
      expect(mocks.navigate).toHaveBeenCalledWith("/unauthorized");
    }
  );
});
