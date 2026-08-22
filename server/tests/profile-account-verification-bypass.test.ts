import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasPrivilegedVerificationBypass,
  hasRequestPrivilegedVerificationBypass,
} from "../utils/privilegedVerification";
import {
  applyProfileAccountEntitlementVerificationBypass,
  resolveProfileAccountEntitlementStatus,
} from "../services/profileAccountEntitlementService";
import { applyProfileAccountVerificationBypass } from "../services/profileAccountService";

const account = Object.freeze({
  id: "account-1",
  profileSlug: "jw-stone",
  profileName: "JW Stone",
  identityKind: "business" as const,
  businessProfileId: "business-1",
  businessName: "JW Stone LLC",
  priorityKey: "stone_business_access",
  status: "active" as const,
  verificationStatus: "pending" as const,
  resumePath: "/u/jw-stone?profileAccount=1",
  lastSeenAt: null,
  bidRockIncluded: true,
});

describe("profile-account privileged verification bypass", () => {
  it("projects pending account verification away only for a privileged viewer", () => {
    expect(applyProfileAccountVerificationBypass(account, false)).toBe(account);

    const projected = applyProfileAccountVerificationBypass(account, true);
    expect(projected).not.toBe(account);
    expect(projected?.verificationStatus).toBe("not_required");
    expect(account.verificationStatus).toBe("pending");
  });

  it("activates verification-derived entitlements while preserving suspension", () => {
    const entitlements = Object.freeze([
      Object.freeze({ productKey: "bidrock", status: "pending_verification" as const }),
      Object.freeze({ productKey: "legacy", status: "revoked" as const }),
      Object.freeze({ productKey: "manual_hold", status: "suspended" as const }),
    ]);

    expect(applyProfileAccountEntitlementVerificationBypass(entitlements, false)).toBe(
      entitlements
    );
    expect(applyProfileAccountEntitlementVerificationBypass(entitlements, true)).toEqual([
      { productKey: "bidrock", status: "active" },
      { productKey: "legacy", status: "active" },
      { productKey: "manual_hold", status: "suspended" },
    ]);
    expect(entitlements[0].status).toBe("pending_verification");
  });

  it("treats accounts with no verification requirement as active", () => {
    expect(resolveProfileAccountEntitlementStatus("not_required")).toBe("active");
    expect(resolveProfileAccountEntitlementStatus("approved")).toBe("active");
    expect(resolveProfileAccountEntitlementStatus("pending")).toBe("pending_verification");
    expect(resolveProfileAccountEntitlementStatus("rejected")).toBe("revoked");
  });

  it("preserves original super-admin bypass outside impersonation", () => {
    expect(
      hasRequestPrivilegedVerificationBypass({
        user: {
          role: "super_admin",
          roles: ["super_admin"],
          isAdmin: true,
          isSuperAdmin: true,
        },
        session: {},
      })
    ).toBe(true);
  });

  it("ignores original admin authority for ordinary impersonated targets", () => {
    const originalSuperAdmin = {
      role: "super_admin",
      roles: ["super_admin"],
      isAdmin: true,
      isSuperAdmin: true,
    };

    for (const impersonatingRole of ["ordinary", "homeowner", "business_owner"]) {
      expect(
        hasRequestPrivilegedVerificationBypass({
          user: originalSuperAdmin,
          session: {
            isImpersonating: true,
            impersonatedUserId: `target-${impersonatingRole}`,
            impersonatingRole,
          },
        })
      ).toBe(false);
    }
  });

  it("allows a privileged impersonated role only through the canonical helper", () => {
    const effectiveRole = "super_admin";
    const effectiveUser = {
      role: effectiveRole,
      activeRole: effectiveRole,
      roles: [effectiveRole],
    };

    expect(hasPrivilegedVerificationBypass(effectiveUser)).toBe(true);
    expect(
      hasRequestPrivilegedVerificationBypass({
        user: {
          role: "homeowner",
          roles: ["homeowner"],
        },
        session: {
          isImpersonating: true,
          impersonatedUserId: "privileged-target",
          impersonatingRole: effectiveRole,
        },
      })
    ).toBe(hasPrivilegedVerificationBypass(effectiveUser));
  });

  it("fails closed for incomplete or ambiguous impersonation sessions", () => {
    const originalSuperAdmin = {
      role: "super_admin",
      roles: ["super_admin"],
      isAdmin: true,
      isSuperAdmin: true,
    };
    const ambiguousSessions = [
      { isImpersonating: true, impersonatingRole: "super_admin" },
      { isImpersonating: true, impersonatedUserId: "target" },
      {
        isImpersonating: false,
        impersonatedUserId: "target",
        impersonatingRole: "super_admin",
      },
      {
        impersonatedUserId: "target",
        impersonatingRole: "super_admin",
      },
      {
        isImpersonating: true,
        impersonatedUserId: "",
        impersonatingRole: "super_admin",
      },
    ];

    for (const session of ambiguousSessions) {
      expect(
        hasRequestPrivilegedVerificationBypass({
          user: originalSuperAdmin,
          session,
        })
      ).toBe(false);
    }
  });

  it("wires the request-aware privileged policy into both profile-account responses", () => {
    const route = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/profile-accounts.ts"),
      "utf8"
    );
    const card = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/profile/PublicProfileAccountCard.tsx"),
      "utf8"
    );

    expect(route.match(/hasRequestPrivilegedVerificationBypass\(req\)/g)).toHaveLength(2);
    expect(route).not.toContain("hasPrivilegedVerificationBypass(req.user)");
    expect(route).toContain("applyProfileAccountVerificationBypass");
    expect(route).toContain("applyProfileAccountEntitlementVerificationBypass");
    expect(card).toContain("!data?.verificationBypassActive");
  });
});
