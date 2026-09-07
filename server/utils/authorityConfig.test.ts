import { describe, expect, it } from "vitest";
import {
  getAuthorityConfig,
  getAuthorityConfigAuditSnapshot,
  reloadAuthorityConfig,
} from "./authorityConfig";

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

describe("authorityConfig", () => {
  it("loads defaults when env is unset", () =>
    withEnv(
      {
        MASTER_ADMIN_EMAIL: undefined,
        SUPER_ADMIN_EMAIL_ALIASES: undefined,
        PRIVILEGED_ALIAS_EMAILS: undefined,
        PRIVILEGED_VERIFICATION_BYPASS_ROLES: undefined,
        DIRECT_CONNECT_ALLOW_UNVERIFIED: undefined,
        DIRECT_CONNECT_DEMO_MODE: undefined,
        TRADE_SCOUT_DEMO_MODE: undefined,
      },
      () => {
        const config = reloadAuthorityConfig();
        expect(config.adminTierRoles).toEqual(["moderator", "ops_admin", "super_admin"]);
        expect(config.verificationBypassRoles).toContain("support_agent");
        expect(config.privilegedAliasEmails).toEqual([]);
        expect(config.directConnectUnverifiedBypassEnabled).toBe(false);
      }
    ));

  it("applies configured role and alias overrides", () =>
    withEnv(
      {
        MASTER_ADMIN_EMAIL: "master@example.com",
        SUPER_ADMIN_EMAIL_ALIASES: "ops@example.com,root@example.com",
        PRIVILEGED_ALIAS_EMAILS: "staff@example.com",
        PRIVILEGED_VERIFICATION_BYPASS_ROLES: "homeowner,contractor",
      },
      () => {
        const config = reloadAuthorityConfig();
        expect(config.privilegedAliasEmails).toEqual(
          expect.arrayContaining([
            "master@example.com",
            "ops@example.com",
            "root@example.com",
            "staff@example.com",
          ])
        );
        expect(config.verificationBypassRoles).toEqual(["contractor", "homeowner"]);
      }
    ));

  it("tracks env changes via fingerprint and refreshes automatically", () =>
    withEnv(
      {
        PRIVILEGED_VERIFICATION_BYPASS_ROLES: "support_agent",
      },
      () => {
        const first = getAuthorityConfig();
        expect(first.verificationBypassRoles).toEqual(["support_agent"]);

        process.env.PRIVILEGED_VERIFICATION_BYPASS_ROLES = "moderator,ops_admin";
        const second = getAuthorityConfig();
        expect(second.fingerprint).not.toBe(first.fingerprint);
        expect(second.verificationBypassRoles).toEqual(["moderator", "ops_admin"]);
      }
    ));

  it("surfaces audit snapshot for admin introspection", () =>
    withEnv(
      {
        DIRECT_CONNECT_DEMO_MODE: "true",
      },
      () => {
        reloadAuthorityConfig();
        const snapshot = getAuthorityConfigAuditSnapshot();
        expect(typeof snapshot.loadedAt).toBe("string");
        expect(snapshot.directConnectUnverifiedBypassEnabled).toBe(true);
        expect(snapshot.env.directConnectDemoModeRaw).toBe("true");
      }
    ));
});
