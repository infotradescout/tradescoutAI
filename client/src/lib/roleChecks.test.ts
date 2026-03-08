import { describe, expect, it } from "vitest";
import { hasAdminUiAccess } from "./roleChecks";

describe("roleChecks admin UI access", () => {
  it("honors legacy admin flags", () => {
    expect(hasAdminUiAccess({ isAdmin: true })).toBe(true);
    expect(hasAdminUiAccess({ isSuperAdmin: true })).toBe(true);
  });

  it("honors canonical admin roles", () => {
    expect(hasAdminUiAccess({ role: "ops_admin" })).toBe(true);
    expect(hasAdminUiAccess({ role: "super_admin" })).toBe(true);
    expect(hasAdminUiAccess({ role: "owner" })).toBe(true);
    expect(hasAdminUiAccess({ role: "homeowner" })).toBe(false);
  });

  it("honors role arrays from normalized sessions", () => {
    expect(hasAdminUiAccess({ roles: ["member", "ops_admin"] })).toBe(true);
    expect(hasAdminUiAccess({ roles: ["member", "super_admin"] })).toBe(true);
    expect(hasAdminUiAccess({ roles: ["member", "homeowner"] })).toBe(false);
  });
});
