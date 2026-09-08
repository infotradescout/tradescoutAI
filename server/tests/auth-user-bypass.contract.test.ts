import { describe, expect, it, vi } from "vitest";
import { storage } from "../storage";
import { createAuthedAgent } from "./helpers/testAuth";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const INTEGRATION_TIMEOUT_MS = 15000;

vi.setConfig({ testTimeout: INTEGRATION_TIMEOUT_MS });

describeWithDb("auth user bypass metadata", () => {
  it("returns privileged bypass metadata for staff/admin tier sessions", async () => {
    const { agent } = await createAuthedAgent({
      role: "ops_admin",
      addressVerified: false,
      onboardingCompleted: true,
    });

    const res = await agent.get("/api/auth/user");
    expect(res.status).toBe(200);
    expect(res.body?.authenticated).toBe(true);
    expect(res.body?.user?.verificationBypass?.active).toBe(true);
    expect(String(res.body?.user?.verificationBypass?.reason || "")).toBe("role");
    expect(Array.isArray(res.body?.user?.verificationBypass?.matchedRoles)).toBe(true);
  });

  it("returns demo bypass metadata for regular users when direct-connect demo mode is enabled", async () => {
    const previous = process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED;
    process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED = "true";

    try {
      const { agent } = await createAuthedAgent({
        role: "homeowner",
        addressVerified: false,
        onboardingCompleted: true,
      });

      const res = await agent.get("/api/auth/user");
      expect(res.status).toBe(200);
      expect(res.body?.authenticated).toBe(true);
      expect(res.body?.user?.verificationBypass?.active).toBe(true);
      expect(res.body?.user?.verificationBypass?.privileged).toBe(false);
      expect(String(res.body?.user?.verificationBypass?.reason || "")).toBe(
        "direct_connect_demo_mode"
      );
      expect(res.body?.user?.verificationBypass?.directConnectDemoMode).toBe(true);
    } finally {
      if (typeof previous === "undefined") {
        delete process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED;
      } else {
        process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED = previous;
      }
    }
  });

  it("does not promote or persist authority for an unverified configured alias", async () => {
    const alias = `reserved+${crypto.randomUUID()}@tradescout.test`;
    const envKeys = [
      "PRIVILEGED_ALIAS_EMAILS",
      "DIRECT_CONNECT_ALLOW_UNVERIFIED",
      "DIRECT_CONNECT_DEMO_MODE",
      "TRADE_SCOUT_DEMO_MODE",
    ] as const;
    const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

    process.env.PRIVILEGED_ALIAS_EMAILS = alias;
    process.env.DIRECT_CONNECT_ALLOW_UNVERIFIED = "false";
    process.env.DIRECT_CONNECT_DEMO_MODE = "false";
    process.env.TRADE_SCOUT_DEMO_MODE = "false";

    try {
      const { agent, user } = await createAuthedAgent({
        email: alias,
        role: "homeowner",
        emailVerified: false,
        onboardingCompleted: true,
      });

      const res = await agent.get("/api/auth/user");
      expect(res.status).toBe(200);
      expect(res.body?.authenticated).toBe(true);
      expect(res.body?.user?.role).toBe("homeowner");
      expect(res.body?.user?.roles || []).not.toContain("super_admin");
      expect(res.body?.user?.isAdmin).toBe(false);
      expect(res.body?.user?.isSuperAdmin).toBe(false);
      expect(res.body?.user?.verificationBypass?.privileged).toBe(false);
      expect(res.body?.user?.verificationBypass?.matchedEmail).toBeNull();

      const persisted = await storage.getUser(user.id);
      expect(persisted?.role).toBe("homeowner");
      expect((persisted as any)?.roles || []).not.toContain("super_admin");
      expect((persisted as any)?.isAdmin).not.toBe(true);
      expect((persisted as any)?.isSuperAdmin).not.toBe(true);
    } finally {
      for (const key of envKeys) {
        const value = previous[key];
        if (typeof value === "undefined") {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
