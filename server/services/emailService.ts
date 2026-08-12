import type { MailDataRequired } from "@sendgrid/mail";
import sgMail from "@sendgrid/mail";

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  // A display name lets business-specific sends (e.g. Express Direct
  // Connect) read as coming from that business rather than TradeScout,
  // while the underlying address still has to be one this account can
  // actually send as (a verified sender, or any address on a verified
  // domain).
  from?: string | { name?: string; email: string };
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  headers?: Record<string, string>;
  /** Optional classifier so we can selectively suppress emails by env */
  purpose?: string;
  /** Upstream work-request / express request id for log correlation (never a secret). */
  requestId?: string | null;
  /** Optional secondary correlation id (e.g. HTTP request id). */
  correlationId?: string | null;
};

export type EmailSkippedReason =
  | "provider_not_configured"
  | "email_mode_suppressed"
  | "brevo_api_key_missing"
  | "unknown_provider";

export type EmailSendResult = {
  skipped: boolean;
  messageId?: string;
  provider: "sendgrid" | "brevo" | "none";
  skippedReason?: EmailSkippedReason;
};

const BREVO_MAX_ATTEMPTS = 3;
const BREVO_TIMEOUT_MS = 15_000;
const BREVO_RETRY_BASE_MS = 500;

/** Mask local-part for logs: `j***@domain.com` (keeps domain for ops triage). */
export function maskEmailForLog(email: string): string {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0 || at === normalized.length - 1) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, 1) || "*";
  return `${visible}***@${domain}`;
}

function recipientSummary(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to])
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .map(maskEmailForLog);
}

function correlationFields(params: Pick<SendEmailParams, "requestId" | "correlationId">) {
  return {
    ...(params.requestId ? { requestId: String(params.requestId) } : {}),
    ...(params.correlationId ? { correlationId: String(params.correlationId) } : {}),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryBrevo(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

class EmailService {
  private configured: boolean;
  private provider: "sendgrid" | "brevo" | "none";
  private defaultFrom: string;
  private brevoApiKey: string | undefined;
  private mode: "all" | "account_creation_only";

  constructor() {
    const providerOverride = String(process.env.EMAIL_PROVIDER || "")
      .toLowerCase()
      .trim();
    const apiKey = process.env.SENDGRID_API_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (providerOverride === "sendgrid") {
      this.provider = apiKey ? "sendgrid" : "none";
    } else if (providerOverride === "brevo") {
      this.provider = brevoApiKey ? "brevo" : "none";
    } else {
      // Default provider preference: SendGrid if present, otherwise Brevo, otherwise none.
      this.provider = apiKey ? "sendgrid" : brevoApiKey ? "brevo" : "none";
    }
    this.configured = this.provider !== "none";

    // Shared "from" default across providers.
    this.defaultFrom =
      process.env.SENDGRID_FROM_EMAIL ||
      process.env.BREVO_FROM_EMAIL ||
      process.env.DEFAULT_FROM_EMAIL ||
      "noreply@tradescout.app";

    this.brevoApiKey = brevoApiKey;

    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }

    const modeRaw = String(process.env.EMAIL_MODE || "all")
      .toLowerCase()
      .trim();
    this.mode = modeRaw === "account_creation_only" ? "account_creation_only" : "all";

    console.info("[email] service initialized", this.getDiagnostics());
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getDiagnostics(): {
    configured: boolean;
    provider: "sendgrid" | "brevo" | "none";
    mode: "all" | "account_creation_only";
    defaultFrom: string;
  } {
    return {
      configured: this.configured,
      provider: this.provider,
      mode: this.mode,
      defaultFrom: this.defaultFrom,
    };
  }

  async sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
    const recipients = recipientSummary(params.to);
    const purpose = String(params.purpose || "unspecified")
      .toLowerCase()
      .trim();
    const correlation = correlationFields(params);
    const baseLog = {
      provider: this.provider,
      purpose,
      subject: params.subject,
      recipients,
      ...correlation,
    };

    if (!this.configured) {
      console.error("[email] send skipped: provider not configured", baseLog);
      return {
        skipped: true,
        provider: this.provider,
        skippedReason: "provider_not_configured",
      };
    }

    if (this.mode === "account_creation_only") {
      const allowed =
        purpose === "account_creation" ||
        purpose === "email_verification" ||
        purpose === "activation" ||
        purpose === "claim_business" ||
        purpose === "tradepartner_interest_admin" ||
        purpose === "tradepartner_rsvp_admin" ||
        purpose === "tradepartner_rsvp_confirmation" ||
        purpose === "tradepartner_request_notification" ||
        // Requester confirmation for Express Direct Connect. Existing-account
        // matches previously used purpose "notification", which EMAIL_MODE
        // account_creation_only silently suppressed in production.
        purpose === "tradepartner_request_confirmation" ||
        // Customer-only copy of JW Stone browser-saved stones (not a JW notify).
        purpose === "jw_stone_saved_stones_copy" ||
        // JW Stone Express Account and sealed-offer delivery is durable in the
        // JW outbox. These explicit purposes must remain available in the
        // production account-only mode; suppressing them would strand account
        // verification, recovery, and already-committed private offers.
        purpose === "jw_stone_express_verification" ||
        purpose === "jw_stone_express_password_reset" ||
        purpose === "jw_stone_offer_confirmation" ||
        purpose === "jw_stone_offer_staff_alert" ||
        purpose === "jw_stone_offer_status" ||
        purpose === "property_participant_invite";
      if (!allowed) {
        console.warn("[email] send suppressed by EMAIL_MODE=account_creation_only", baseLog);
        return {
          skipped: true,
          provider: this.provider,
          skippedReason: "email_mode_suppressed",
        };
      }
    }

    if (!params.html && !params.text) {
      throw new Error("Email requires html or text content");
    }

    console.info("[email] send start", baseLog);

    const from =
      typeof params.from === "object" && params.from
        ? params.from
        : { email: params.from || this.defaultFrom };

    // Brevo needs real addresses in the API body; masked list is log-only.
    const rawRecipients = (Array.isArray(params.to) ? params.to : [params.to])
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean);

    if (this.provider === "sendgrid") {
      const content: Array<{ type: "text/html" | "text/plain"; value: string }> = [];
      if (params.html) content.push({ type: "text/html", value: params.html });
      if (params.text) content.push({ type: "text/plain", value: params.text });

      const payload: MailDataRequired = {
        to: params.to,
        from: from.name ? { email: from.email, name: from.name } : from.email,
        subject: params.subject,
        content: content as any,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        headers: params.headers,
      };

      try {
        const [response] = await sgMail.send(payload);
        const rawMessageId = (response?.headers as any)?.["x-message-id"];
        const messageId = Array.isArray(rawMessageId) ? rawMessageId[0] : rawMessageId;
        console.info("[email] provider accepted message", {
          ...baseLog,
          provider: "sendgrid",
          messageId: messageId || null,
        });
        return { skipped: false, messageId, provider: "sendgrid" };
      } catch (error) {
        console.error("[email] provider rejected message", {
          ...baseLog,
          provider: "sendgrid",
          error,
        });
        throw error;
      }
    }

    if (this.provider === "brevo") {
      if (!this.brevoApiKey) {
        console.error("[email] send skipped: Brevo selected but API key missing", baseLog);
        return {
          skipped: true,
          provider: "brevo",
          skippedReason: "brevo_api_key_missing",
        };
      }
      const fetchFn = (globalThis as any).fetch as undefined | typeof fetch;
      if (!fetchFn) {
        throw new Error("Brevo email requires global fetch() (Node 18+)");
      }

      const payload = {
        sender: from.name ? { email: from.email, name: from.name } : { email: from.email },
        to: rawRecipients.map((email) => ({ email })),
        subject: params.subject,
        ...(params.html ? { htmlContent: params.html } : {}),
        ...(params.text ? { textContent: params.text } : {}),
        ...(params.cc?.length ? { cc: params.cc.map((email) => ({ email })) } : {}),
        ...(params.bcc?.length ? { bcc: params.bcc.map((email) => ({ email })) } : {}),
        ...(params.replyTo ? { replyTo: { email: params.replyTo } } : {}),
        ...(params.headers ? { headers: params.headers } : {}),
      };

      let lastError: unknown = null;
      for (let attempt = 1; attempt <= BREVO_MAX_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), BREVO_TIMEOUT_MS);
        try {
          const resp = await fetchFn("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              "api-key": this.brevoApiKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          const responseText = await resp.text().catch(() => "");
          if (!resp.ok) {
            const error = new Error(
              `Brevo send failed (${resp.status}): ${responseText || resp.statusText}`
            );
            lastError = error;
            const retry = attempt < BREVO_MAX_ATTEMPTS && shouldRetryBrevo(resp.status);
            console.error("[email] Brevo rejected message", {
              ...baseLog,
              status: resp.status,
              attempt,
              retry,
              response: responseText || resp.statusText,
            });
            if (!retry) throw error;
          } else {
            const json: any = responseText ? JSON.parse(responseText) : null;
            const messageId = json?.messageId || json?.["messageId"];
            console.info("[email] provider accepted message", {
              ...baseLog,
              provider: "brevo",
              attempt,
              messageId: typeof messageId === "string" ? messageId : null,
            });
            return {
              skipped: false,
              messageId: typeof messageId === "string" ? messageId : undefined,
              provider: "brevo",
            };
          }
        } catch (error) {
          lastError = error;
          const retry = attempt < BREVO_MAX_ATTEMPTS;
          console.error("[email] Brevo delivery attempt failed", {
            ...baseLog,
            attempt,
            retry,
            error,
          });
          if (!retry) throw error;
        } finally {
          clearTimeout(timeout);
        }

        await sleep(BREVO_RETRY_BASE_MS * 2 ** (attempt - 1));
      }

      throw lastError instanceof Error ? lastError : new Error("Brevo send failed");
    }

    console.error("[email] send skipped: unknown provider", baseLog);
    return {
      skipped: true,
      provider: this.provider,
      skippedReason: "unknown_provider",
    };
  }
}

export const emailService = new EmailService();
