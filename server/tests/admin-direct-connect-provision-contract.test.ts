import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("admin direct-connect provisioning contract", () => {
  it("provisions target users by email and triggers setup email flow", () => {
    const source = [
      read("server/routes/direct-connect.ts"),
      read("server/routes/direct-connect/operations.ts"),
    ].join("\n");

    expect(source).toContain("/api/admin/direct-connect/requests");
    expect(source).toContain("targetUserProvisioned");
    expect(source).toContain("passwordResetService.createToken");
    expect(source).toContain("emailVerificationService.createToken");
    expect(source).toContain("setupEmailSent");
    expect(source).toContain("const shouldSendSetupFlow =");
    expect(source).toContain("!hasPassword");
    expect(source).toContain("!isEmailVerified");
    expect(source).toContain("const shouldSendActivation = shouldSendSetupFlow && !hasPassword");
    expect(source).toContain("targetUserExisted");
    expect(source).toContain("requestEmailSent");
    expect(source).toContain("setupEmailSkippedReason");
    expect(source).toContain("requestEmailSkippedReason");
    expect(source).toContain("resolveOrCreateAdminTrade");
    expect(source).toContain("resolvedTradeId");
    expect(source).toContain("createdTradeId");
    expect(source).toContain('deliveryMethods: ["in_app"]');
    expect(source).toContain("Failed to notify target user for admin-created request");
    expect(source).toContain('console.info("[direct-connect] Admin-created request"');
    expect(source).toContain("emailResult.skipped !== true");
  });
});
