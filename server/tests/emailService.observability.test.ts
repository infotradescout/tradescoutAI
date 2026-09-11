import { afterEach, describe, expect, it, vi } from "vitest";

describe("emailService observability", () => {
  it("preserves account-creation-only mode for generic and Direct Connect notification purpose", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", "test-brevo-key-not-real");
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_MODE", "account_creation_only");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { emailService } = await import("../services/emailService");
    expect(
      await emailService.sendEmail({
        to: "synthetic@example.com",
        subject: "Direct Connect update",
        text: "Open the inbox",
        purpose: "notification",
        singleAttempt: true,
      })
    ).toMatchObject({ skipped: true, skippedReason: "email_mode_suppressed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it.each([
    { status: 400, disposition: "rejected" },
    { status: 429, disposition: "retryable" },
    { status: 408, disposition: "unknown" },
    { status: 503, disposition: "unknown" },
  ])(
    "leaves durable Brevo $status outcomes to the outbox after one attempt",
    async ({ status, disposition }) => {
      vi.stubEnv("EMAIL_PROVIDER", "brevo");
      vi.stubEnv("BREVO_API_KEY", "test-brevo-key-not-real");
      vi.stubEnv("SENDGRID_API_KEY", "");
      vi.stubEnv("EMAIL_MODE", "all");
      vi.spyOn(console, "info").mockImplementation(() => {});
      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: false, status, text: async () => "provider response" });
      vi.stubGlobal("fetch", fetchMock);
      const { emailService } = await import("../services/emailService");
      await expect(
        emailService.sendEmail({
          to: "synthetic@example.com",
          subject: "Fixture",
          text: "Fixture",
          purpose: "notification",
          singleAttempt: true,
        })
      ).rejects.toMatchObject({ disposition });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  );

  it("retains ambiguous Brevo transport failures without an internal retry", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", "test-brevo-key-not-real");
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_MODE", "all");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValue(new Error("Connection lost after submission"));
    vi.stubGlobal("fetch", fetchMock);
    const { emailService } = await import("../services/emailService");
    await expect(
      emailService.sendEmail({
        to: "synthetic@example.com",
        subject: "Fixture",
        text: "Fixture",
        singleAttempt: true,
      })
    ).rejects.toMatchObject({ disposition: "unknown" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not repeat accepted Brevo mail when the optional receipt body is malformed", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", "test-brevo-key-not-real");
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_MODE", "all");
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, text: async () => "malformed optional receipt" });
    vi.stubGlobal("fetch", fetchMock);
    const { emailService } = await import("../services/emailService");
    expect(
      await emailService.sendEmail({
        to: "synthetic@example.com",
        subject: "Fixture",
        text: "Fixture",
        singleAttempt: true,
      })
    ).toMatchObject({ skipped: false, provider: "brevo" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { code: 429, disposition: "retryable" },
    { code: 403, disposition: "rejected" },
    { code: "ETIMEDOUT", disposition: "unknown" },
  ])("classifies SendGrid $code without duplicate submission", async ({ code, disposition }) => {
    vi.stubEnv("EMAIL_PROVIDER", "sendgrid");
    vi.stubEnv("SENDGRID_API_KEY", "SG.test-key-not-real");
    vi.stubEnv("EMAIL_MODE", "all");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sgMail = (await import("@sendgrid/mail")).default;
    const send = vi
      .spyOn(sgMail, "send")
      .mockRejectedValue(Object.assign(new Error("Provider fixture"), { code }));
    const timeout = vi.spyOn(sgMail, "setTimeout");
    const { emailService } = await import("../services/emailService");
    await expect(
      emailService.sendEmail({
        to: "synthetic@example.com",
        subject: "Fixture",
        text: "Fixture",
        singleAttempt: true,
      })
    ).rejects.toMatchObject({ disposition });
    expect(send).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(15000);
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
