import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const message = { to: "synthetic@example.com", subject: "Retry fixture", text: "Synthetic fixture" };
const response = (status: number, body = "provider fixture") => ({
  ok: status >= 200 && status < 300, status, statusText: "fixture", text: async () => body,
});

describe("Brevo direct submission retry safety", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "brevo");
    vi.stubEnv("BREVO_API_KEY", "synthetic-not-real");
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("EMAIL_MODE", "all");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it.each([400, 401, 403, 422, 408, 500, 503])("does not resubmit HTTP %s", async (status) => {
    const provider = vi.fn().mockResolvedValue(response(status));
    vi.stubGlobal("fetch", provider);
    const { emailService } = await import("../services/emailService");
    await expect(emailService.sendEmail(message)).rejects.toThrow(`Brevo send failed (${status})`);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("does not resubmit transport failure, durable=%s", async (singleAttempt) => {
    const provider = vi.fn().mockRejectedValue(new Error("lost response after possible acceptance"));
    vi.stubGlobal("fetch", provider);
    const { emailService } = await import("../services/emailService");
    const outcome = emailService.sendEmail({ ...message, singleAttempt });
    if (singleAttempt) await expect(outcome).rejects.toMatchObject({ disposition: "unknown" });
    else await expect(outcome).rejects.toThrow("lost response");
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("does not resubmit after the provider request times out", async () => {
    vi.useFakeTimers();
    const provider = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new Error("provider timeout")));
    }));
    vi.stubGlobal("fetch", provider);
    const { emailService } = await import("../services/emailService");
    const settled = emailService.sendEmail(message).catch(error => error);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await settled).toMatchObject({ message: "provider timeout" });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("keeps a durable unreadable acceptance receipt accepted", async () => {
    const provider = vi.fn().mockResolvedValue({
      ...response(201), text: async () => { throw new Error("response stream lost"); },
    });
    vi.stubGlobal("fetch", provider);
    const { emailService } = await import("../services/emailService");
    await expect(emailService.sendEmail({ ...message, singleAttempt: true })).resolves.toMatchObject({
      skipped: false, provider: "brevo", messageId: undefined,
    });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it.each([201, 429, 503])("does not resubmit an unreadable HTTP %s receipt", async (status) => {
    const provider = vi.fn().mockResolvedValue({
      ...response(status), text: async () => { throw new Error("response stream lost"); },
    });
    vi.stubGlobal("fetch", provider);
    const { emailService } = await import("../services/emailService");
    if (status === 201) {
      await expect(emailService.sendEmail(message)).resolves.toMatchObject({
        skipped: false, provider: "brevo", messageId: undefined,
      });
    } else await expect(emailService.sendEmail(message)).rejects.toThrow("response stream lost");
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("keeps malformed accepted receipts accepted, durable=%s", async (singleAttempt) => {
    const provider = vi.fn().mockResolvedValue(response(201, "malformed JSON"));
    vi.stubGlobal("fetch", provider);
    const { emailService } = await import("../services/emailService");
    await expect(emailService.sendEmail({ ...message, singleAttempt })).resolves.toMatchObject({
      skipped: false, provider: "brevo", messageId: undefined,
    });
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it.each(["accepted", "rate-limit", "ambiguous", "permanent"])("bounds known 429 retry followed by %s", async (next) => {
    vi.useFakeTimers();
    const provider = vi.fn().mockResolvedValue(response(429));
    if (next === "accepted") provider.mockResolvedValueOnce(response(429)).mockResolvedValue(response(201, '{"messageId":"fixture-id"}'));
    if (next === "ambiguous") provider.mockResolvedValueOnce(response(429)).mockRejectedValue(new Error("lost response"));
    if (next === "permanent") provider.mockResolvedValueOnce(response(429)).mockResolvedValue(response(400));
    vi.stubGlobal("fetch", provider);
    const { emailService } = await import("../services/emailService");
    const settled = emailService.sendEmail(message).then(value => ({ value }), error => ({ error }));
    await vi.runAllTimersAsync();
    const outcome = await settled;
    if (next === "accepted") expect(outcome).toMatchObject({ value: { messageId: "fixture-id" } });
    else expect(outcome).toHaveProperty("error");
    expect(provider).toHaveBeenCalledTimes(next === "rate-limit" ? 3 : 2);
  });
});
