import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("admin direct-connect provisioning contract", () => {
  it("provisions target users by email and triggers setup email flow", () => {
    const source = read("server/routes/direct-connect.ts");
    const notifications = read("server/notification-service.ts");

    expect(source).toContain("/api/admin/direct-connect/requests");
    expect(source).toContain("targetUserProvisioned");
    expect(source).toContain("notificationService.enqueueDirectConnectAccountSetupEmail");
    expect(source).toContain("notificationService.dispatchDirectConnectEmail");
    expect(source).not.toContain("passwordResetService.createToken");
    expect(source).not.toContain("emailVerificationService.createToken");
    expect(source).not.toContain("emailService.sendEmail");
    expect(notifications).toContain("passwordResetService.createScopedToken");
    expect(notifications).toContain("emailVerificationService.createScopedToken");
    expect(notifications).toContain("`notification-delivery:${deliveryIntentId}`");
    expect(source).toContain("setupEmailSent");
    expect(source).toContain("const shouldSendSetupFlow =");
    expect(source).toContain("!targetHasPassword");
    expect(source).toContain("!targetEmailVerified");
    expect(source).toContain(
      "const shouldSendActivation = shouldSendSetupFlow && !targetHasPassword"
    );
    expect(source).toContain("targetUserExisted");
    expect(source).toContain("requestEmailSent");
    expect(source).toContain("setupEmailSkippedReason");
    expect(source).toContain("requestEmailSkippedReason");
    expect(source).toContain("resolveOrCreateAdminTrade");
    expect(source).toContain("resolvedTradeId");
    expect(source).toContain("createdTradeId");
    expect(notifications).toContain('deliveryMethods: ["in_app", "email"]');
    expect(source).not.toContain('deliveryMethods: ["in_app"]');
    expect(source).not.toContain("Failed to notify target user for admin-created request");
    expect(source).toContain('console.info("[direct-connect] Admin-created request"');
    expect(source).toContain('["sent", "delivered"].includes(emailDeliveryStatus)');
    expect(source).toContain("emailRetryCount");
    expect(source).toContain("emailNextRetryAt");
  });
});
