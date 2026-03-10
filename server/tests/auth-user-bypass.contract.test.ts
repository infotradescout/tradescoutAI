import { describe, expect, it } from "vitest";
import { createAuthedAgent } from "./helpers/testAuth";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeWithDb("auth user bypass metadata", () => {
  it("returns privileged bypass metadata for staff/admin tier sessions", async () => {
    const { agent } = await createAuthedAgent({
      role: "support_agent" as any,
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
});
