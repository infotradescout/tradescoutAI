import { describe, expect, it } from "vitest";
import {
  collectAuthorityRoles,
  getPrivilegedAliasEmails,
  getVerificationBypassRoles,
  hasManualDirectConnectBypassRequest,
  isDirectConnectUnverifiedBypassEnabled,
  isPrivilegedAliasEmail,
  isTruthyToggle,
  normalizeAuthorityRole,
  resolvePrivilegedVerificationBypass,
} from "./authorityPolicy";

function withEnv(
  values: Record<string, string | undefined>,
  fn: () => void | Promise<void>
): Promise<void> | void {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    original[key] = process.env[key];
    const value = values[key];
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const restore = () => {
    for (const key of Object.keys(values)) {
      const value = original[key];
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  const result = fn();
  if (result && typeof (result as Promise<void>).then === "function") {
    return (result as Promise<void>).finally(restore);
  }
  restore();
}

describe("authorityPolicy", () => {
  it("normalizes legacy admin role aliases", () => {
    expect(normalizeAuthorityRole("owner")).toBe("super_admin");
    expect(normalizeAuthorityRole("head_admin")).toBe("super_admin");
    expect(normalizeAuthorityRole(" ops_admin ")).toBe("ops_admin");
    expect(normalizeAuthorityRole("")).toBe("");
  });

  it("collects and deduplicates authority roles from role/activeRole/roles", () => {
    const roles = collectAuthorityRoles({
      role: "owner",
      activeRole: "ops_admin",
      roles: ["support_agent", "owner", "support_agent", "  "],
    });
    expect(roles).toEqual(["super_admin", "ops_admin", "support_agent"]);
  });

  it("uses configured bypass roles when PRIVILEGED_VERIFICATION_BYPASS_ROLES is set", () =>
    withEnv({ PRIVILEGED_VERIFICATION_BYPASS_ROLES: "homeowner,contractor" }, () => {
      const roles = getVerificationBypassRoles();
      expect(roles.has("homeowner")).toBe(true);
      expect(roles.has("contractor")).toBe(true);
      expect(roles.has("support_agent")).toBe(false);
    }));

  it("includes default alias emails and configured aliases", () =>
    withEnv(
      {
        MASTER_ADMIN_EMAIL: "master@example.com",
        SUPER_ADMIN_EMAIL_ALIASES: "ops@example.com,root@example.com",
        PRIVILEGED_ALIAS_EMAILS: "staff@example.com",
      },
      () => {
        const aliases = getPrivilegedAliasEmails();
        expect(aliases.has("master@example.com")).toBe(true);
        expect(aliases.has("ops@example.com")).toBe(true);
        expect(aliases.has("root@example.com")).toBe(true);
        expect(aliases.has("staff@example.com")).toBe(true);
        expect(aliases.has("info.tradescout@gmail.com")).toBe(true);
      }
    ));

  it("resolves privileged bypass from role", () =>
    withEnv({ PRIVILEGED_VERIFICATION_BYPASS_ROLES: "support_agent" }, () => {
      const resolution = resolvePrivilegedVerificationBypass({
        role: "support_agent",
        email: "user@example.com",
      });
      expect(resolution.active).toBe(true);
      expect(resolution.reason).toBe("role");
      expect(resolution.matchedRoles).toContain("support_agent");
    }));

  it("resolves privileged bypass from configured alias email", () =>
    withEnv(
      {
        MASTER_ADMIN_EMAIL: "master@example.com",
        SUPER_ADMIN_EMAIL_ALIASES: "ops@example.com",
        PRIVILEGED_ALIAS_EMAILS: "staff@example.com",
      },
      () => {
        const resolution = resolvePrivilegedVerificationBypass({
          role: "homeowner",
          email: "Staff@Example.com",
        });
        expect(resolution.active).toBe(true);
        expect(resolution.reason).toBe("email_alias");
        expect(resolution.matchedEmail).toBe("staff@example.com");
      }
    ));

  it("resolves privileged bypass from admin flags", () => {
    const resolution = resolvePrivilegedVerificationBypass({
      role: "homeowner",
      isAdmin: true,
    });
    expect(resolution.active).toBe(true);
    expect(resolution.reason).toBe("admin_flag");
  });

  it("returns inactive bypass when no privileged signal is present", () =>
    withEnv(
      {
        MASTER_ADMIN_EMAIL: undefined,
        SUPER_ADMIN_EMAIL_ALIASES: undefined,
        PRIVILEGED_ALIAS_EMAILS: undefined,
        PRIVILEGED_VERIFICATION_BYPASS_ROLES: undefined,
      },
      () => {
        const resolution = resolvePrivilegedVerificationBypass({
          role: "homeowner",
          email: "user@example.com",
          isAdmin: false,
          isSuperAdmin: false,
        });
        expect(resolution.active).toBe(false);
        expect(resolution.reason).toBe("none");
      }
    ));

  it("handles direct connect env bypass toggles", () =>
    withEnv(
      {
        DIRECT_CONNECT_ALLOW_UNVERIFIED: "false",
        DIRECT_CONNECT_DEMO_MODE: "enabled",
        TRADE_SCOUT_DEMO_MODE: "false",
      },
      () => {
        expect(isDirectConnectUnverifiedBypassEnabled()).toBe(true);
      }
    ));

  it("parses truthy toggles consistently", () => {
    expect(isTruthyToggle(true)).toBe(true);
    expect(isTruthyToggle(1)).toBe(true);
    expect(isTruthyToggle("YES")).toBe(true);
    expect(isTruthyToggle("off")).toBe(false);
    expect(isTruthyToggle(undefined)).toBe(false);
  });

  it("detects manual direct-connect bypass request from body/query/header", () => {
    expect(
      hasManualDirectConnectBypassRequest({
        body: { allowUnverifiedDirectConnect: true },
        query: {},
        headers: {},
      } as any)
    ).toBe(true);

    expect(
      hasManualDirectConnectBypassRequest({
        body: {},
        query: { demoBypassVerification: "true" },
        headers: {},
      } as any)
    ).toBe(true);

    expect(
      hasManualDirectConnectBypassRequest({
        body: {},
        query: {},
        headers: { "x-direct-connect-demo-bypass": "1" },
      } as any)
    ).toBe(true);

    expect(
      hasManualDirectConnectBypassRequest({
        body: {},
        query: {},
        headers: {},
      } as any)
    ).toBe(false);
  });

  it("checks alias email membership case-insensitively", () =>
    withEnv({ PRIVILEGED_ALIAS_EMAILS: "Alias@Test.Example" }, () => {
      expect(isPrivilegedAliasEmail("alias@test.example")).toBe(true);
      expect(isPrivilegedAliasEmail("nobody@test.example")).toBe(false);
    }));
});
