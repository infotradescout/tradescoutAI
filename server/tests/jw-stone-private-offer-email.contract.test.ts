import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const emailServiceSource = readFileSync("server/services/emailService.ts", "utf8");

const requiredJwPurposes = [
  "jw_stone_express_verification",
  "jw_stone_express_password_reset",
  "jw_stone_offer_confirmation",
  "jw_stone_offer_staff_alert",
  "jw_stone_offer_status",
] as const;

describe("JW Stone private-offer email contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("keeps every durable JW purpose deliverable in restricted production email mode", () => {
    for (const purpose of requiredJwPurposes) {
      expect(emailServiceSource).toContain(`purpose === "${purpose}"`);
    }
  });

  it("does not use a generic notification purpose for JW account or private-offer mail", () => {
    expect(requiredJwPurposes).not.toContain("notification" as never);
    expect(new Set(requiredJwPurposes).size).toBe(requiredJwPurposes.length);
  });

  it("actually sends every JW purpose through restricted Brevo mode", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", "test-jw-brevo-key-not-real");
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_MODE", "account_creation_only");
    vi.stubEnv("BREVO_FROM_EMAIL", "noreply@example.com");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ messageId: "jw-test-message" }),
      })
    );

    const { emailService } = await import("../services/emailService");
    for (const purpose of requiredJwPurposes) {
      await expect(
        emailService.sendEmail({
          to: "buyer@example.com",
          subject: `JW purpose ${purpose}`,
          text: "JW Stone test delivery",
          purpose,
          requestId: `test-${purpose}`,
        })
      ).resolves.toEqual(expect.objectContaining({ skipped: false, provider: "brevo" }));
    }
  });
});
