import { describe, expect, it } from "vitest";
import { sanitizeAuthUserAuthority, type User } from "@/hooks/useAuth";
import {
  getVerificationBypassReasonLabel,
  isPrivilegedVerificationBypass,
} from "./verificationBypass";

describe("verification bypass client authority", () => {
  it("recognizes only persisted role/flag or explicit manual authority reasons", () => {
    expect(isPrivilegedVerificationBypass({ active: true, reason: "role" })).toBe(true);
    expect(isPrivilegedVerificationBypass({ active: true, reason: "admin_flag" })).toBe(true);
    expect(
      isPrivilegedVerificationBypass({
        active: true,
        privileged: true,
        reason: "manual_direct_connect_override",
      })
    ).toBe(true);
    expect(
      isPrivilegedVerificationBypass({
        active: true,
        privileged: true,
        reason: "direct_connect_demo_mode",
      })
    ).toBe(false);
  });

  it("drops obsolete unknown bypass metadata from cached auth payloads", () => {
    const user = {
      id: "user-1",
      email: "candidate@example.com",
      role: "homeowner",
      verificationBypass: {
        active: true,
        privileged: true,
        reason: "obsolete_authority_reason",
      },
    } as unknown as User;

    const sanitized = sanitizeAuthUserAuthority(user);
    expect(sanitized.verificationBypass).toBeUndefined();
    expect(sanitized.role).toBe("homeowner");
  });

  it("contains no user-facing label for an email-derived override", () => {
    const labels = [
      getVerificationBypassReasonLabel("role"),
      getVerificationBypassReasonLabel("admin_flag"),
      getVerificationBypassReasonLabel("manual_direct_connect_override"),
      getVerificationBypassReasonLabel("direct_connect_demo_mode"),
      getVerificationBypassReasonLabel("none"),
    ];

    expect(labels.join(" ").toLowerCase()).not.toContain("alias");
    expect(labels.join(" ").toLowerCase()).not.toContain("email");
  });
});
