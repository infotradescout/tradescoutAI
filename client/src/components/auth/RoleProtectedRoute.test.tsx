// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoleProtectedRoute } from "./RoleProtectedRoute";
import { hasExplicitRoleGrant, type UserRole } from "@shared/roles";

const state = vi.hoisted(() => ({
  user: { role: "homeowner" } as { role: string } | null,
  isAuthenticated: true,
  isLoading: false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("explicit client role boundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.assign(state, { user: { role: "homeowner" }, isAuthenticated: true, isLoading: false });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  function render(allowedRoles: UserRole[]) {
    act(() =>
      root.render(
        <RoleProtectedRoute allowedRoles={allowedRoles} fallback={<p>Restricted</p>}>
          <button>Protected action</button>
        </RoleProtectedRoute>
      )
    );
  }

  it.each([
    ["support_agent", "community_moderator"],
    ["super_admin", "contractor_user"],
    ["content_seo", "support_agent"],
  ] as [UserRole, UserRole][])("does not render %s into %s by rank", (role, allowed) => {
    state.user = { role };
    render([allowed]);
    expect(container.textContent).toBe("Restricted");
    expect(container.querySelector("button")).toBeNull();
  });

  it.each(["support_agent", "community_moderator", "super_admin"] as UserRole[])(
    "renders an explicitly permitted %s",
    (role) => {
      state.user = { role };
      render([role]);
      expect(container.querySelector("button")?.textContent).toBe("Protected action");
    }
  );

  it("withholds actions while identity loads and after sign-out", () => {
    state.user = { role: "super_admin" };
    state.isLoading = true;
    render(["super_admin"]);
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    state.isLoading = false;
    state.isAuthenticated = false;
    render(["super_admin"]);
    expect(container.textContent).toBe("Restricted");
    state.isAuthenticated = true;
    state.user = null;
    render(["super_admin"]);
    expect(container.textContent).toBe("Restricted");
  });

  it("rejects an empty allowlist and unknown roles in the shared predicate", () => {
    expect(hasExplicitRoleGrant("super_admin", [])).toBe(false);
    expect(hasExplicitRoleGrant("unknown_role" as UserRole, ["homeowner"])).toBe(false);
  });
});
