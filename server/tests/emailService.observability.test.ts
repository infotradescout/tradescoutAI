import { afterEach, describe, expect, it, vi } from "vitest";

describe("emailService observability", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("masks recipient local-parts for logs", async () => {
    const { maskEmailForLog } = await import("../services/emailService");
    expect(maskEmailForLog("levon@jwstonelogistics.com")).toBe("l***@jwstonelogistics.com");
    expect(maskEmailForLog("A@example.com")).toBe("a***@example.com");
    expect(maskEmailForLog("not-an-email")).toBe("***");
  });

  it("returns skippedReason and logs requestId when provider is not configured", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_MODE", "all");

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { emailService } = await import("../services/emailService");

    const result = await emailService.sendEmail({
      to: "ops@example.com",
      subject: "Express observability probe",
      text: "probe",
      purpose: "tradepartner_request_notification",
      requestId: "req-observability-1",
      correlationId: "http-observability-1",
    });

    expect(result.skipped).toBe(true);
    expect(result.provider).toBe("none");
    expect(result.skippedReason).toBe("provider_not_configured");
    expect(errorSpy).toHaveBeenCalledWith(
      "[email] send skipped: provider not configured",
      expect.objectContaining({
        requestId: "req-observability-1",
        correlationId: "http-observability-1",
        purpose: "tradepartner_request_notification",
        recipients: ["o***@example.com"],
      })
    );
  });

  it("logs send start and provider accepted with requestId on Brevo success", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", "test-brevo-key-not-real");
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_MODE", "account_creation_only");
    vi.stubEnv("BREVO_FROM_EMAIL", "noreply@tradescout.app");

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ messageId: "brevo-msg-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { emailService } = await import("../services/emailService");
    const result = await emailService.sendEmail({
      to: "buyer@example.com",
      subject: "Your request was sent",
      text: "confirmation",
      purpose: "account_creation",
      requestId: "req-observability-2",
    });

    expect(result).toEqual({
      skipped: false,
      messageId: "brevo-msg-123",
      provider: "brevo",
    });
    expect(infoSpy).toHaveBeenCalledWith(
      "[email] send start",
      expect.objectContaining({
        requestId: "req-observability-2",
        purpose: "account_creation",
        recipients: ["b***@example.com"],
      })
    );
    expect(infoSpy).toHaveBeenCalledWith(
      "[email] provider accepted message",
      expect.objectContaining({
        requestId: "req-observability-2",
        messageId: "brevo-msg-123",
        provider: "brevo",
      })
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    // API payload must use the real address; only logs are masked.
    expect(body.to).toEqual([{ email: "buyer@example.com" }]);
    expect(String(fetchMock.mock.calls[0][1].headers["api-key"])).toBe("test-brevo-key-not-real");
  });
});
