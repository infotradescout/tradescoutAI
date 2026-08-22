import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

  it("wires the canonical privileged policy into both profile-account responses", () => {
    const route = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/profile-accounts.ts"),
      "utf8"
    );
    const card = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/profile/PublicProfileAccountCard.tsx"),
      "utf8"
    );

    expect(route.match(/hasPrivilegedVerificationBypass\(req\.user\)/g)).toHaveLength(2);
    expect(route).toContain("applyProfileAccountVerificationBypass");
    expect(route).toContain("applyProfileAccountEntitlementVerificationBypass");
    expect(card).toContain("!data?.verificationBypassActive");
  });
});
