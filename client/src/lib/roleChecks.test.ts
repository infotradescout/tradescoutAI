import { describe, expect, it } from "vitest";
import {
  hasAdminUiAccess,
  hasBusinessProviderToolAccess,
  isBusinessProviderRole,
} from "./roleChecks";

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

  it("honors activeRole when admin authority is carried there", () => {
    expect(hasAdminUiAccess({ role: "homeowner", activeRole: "ops_admin" })).toBe(true);
    expect(hasAdminUiAccess({ role: "member", activeRole: "super_admin" })).toBe(true);
  });

  it("honors role arrays from normalized sessions", () => {
    expect(hasAdminUiAccess({ roles: ["member", "ops_admin"] })).toBe(true);
    expect(hasAdminUiAccess({ roles: ["member", "super_admin"] })).toBe(true);
    expect(hasAdminUiAccess({ roles: ["member", "homeowner"] })).toBe(false);
  });

  it("does not infer admin UI access from substrings or untrusted claims", () => {
    for (const role of ["hoa_admin", "assistant_admin", "organization_admin"]) {
      expect(hasAdminUiAccess({ role })).toBe(false);
      expect(hasAdminUiAccess({ roles: [role] })).toBe(false);
    }
    expect(
      hasAdminUiAccess({
        role: "homeowner",
        claims: {
          role: "super_admin",
          roles: ["ops_admin"],
          isAdmin: true,
          isSuperAdmin: true,
        },
      })
    ).toBe(false);
    expect(hasAdminUiAccess({ role: "moderator" })).toBe(true);
  });

  it("never derives admin UI access from direct or claims email aliases", () => {
    expect(hasAdminUiAccess({ email: "contact@thetradescout.com" })).toBe(false);
    expect(hasAdminUiAccess({ email: "info.tradescout@gmail.com" })).toBe(false);
    expect(
      hasAdminUiAccess({
        email: "ordinary@example.com",
        claims: { email: "contact@thetradescout.com" },
      })
    ).toBe(false);
  });
});

describe("roleChecks business provider access", () => {
  it("recognizes generic and legacy provider roles", () => {
    expect(isBusinessProviderRole("business_owner")).toBe(true);
    expect(isBusinessProviderRole("contractor_user")).toBe(true);
    expect(isBusinessProviderRole("accelerator_member")).toBe(true);
    expect(isBusinessProviderRole("homeowner")).toBe(false);
  });

  it("checks role arrays and active role for business-provider tools", () => {
    expect(hasBusinessProviderToolAccess({ role: "homeowner", activeRole: "business_owner" })).toBe(
      true
    );
    expect(hasBusinessProviderToolAccess({ role: "homeowner", roles: ["helper"] })).toBe(true);
    expect(hasBusinessProviderToolAccess({ role: "homeowner" })).toBe(false);
  });
});
