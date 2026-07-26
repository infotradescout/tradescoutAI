import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Direct Connect email operations contract", () => {
  const route = read("server/routes/direct-connect.ts");
  const oversight = read("server/services/directConnectBetaOversight.ts");
  const notifications = read("server/notification-service.ts");
  const email = read("server/services/emailService.ts");
  const queue = read("client/src/components/admin/AdminDirectConnectQueue.tsx");

  it("requests email delivery for providers and super-admin oversight", () => {
    expect(route).toContain('deliveryMethods: ["in_app", "email", "push"]');
    expect(oversight).toContain('deliveryMethods: ["in_app", "email"]');
    expect(oversight).toContain('type: "direct_connect_beta_request"');
  });

  it("allows Direct Connect purposes in restricted email mode", () => {
    expect(email).toContain('purpose === "direct_connect_request"');
    expect(email).toContain('purpose === "direct_connect_admin_oversight"');
    expect(email).toContain('purpose === "direct_connect_account_setup"');
    expect(route).toMatch(/purpose: "(?:email_verification|direct_connect_account_setup)"/);
    expect(route).toContain('purpose: "direct_connect_request"');
    expect(route).not.toContain('purpose: "account_verification"');
  });

  it("uses the shared configured provider and records its message id", () => {
    expect(notifications).toContain('import { emailService } from "./services/emailService"');
    expect(notifications).toContain("result.messageId");
    expect(notifications).not.toContain('from: "notifications@tradescout.app"');
  });

  it("exposes a staff queue instead of detail-by-notification only", () => {
    expect(route).toContain('"/api/admin/direct-connect/requests"');
    expect(queue).toContain("Every request available to TradeScout staff");
    expect(queue).toContain("requestId=");
  });
});
