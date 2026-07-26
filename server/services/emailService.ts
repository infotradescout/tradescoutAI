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
};

export type SendEmailResult = {
  skipped: boolean;
  messageId?: string;
  provider: "sendgrid" | "brevo" | "none";
  skippedReason?:
    | "provider_not_configured"
    | "sender_not_configured"
    | "email_mode_suppressed";
};

export type EmailMode = "all" | "account_creation_only";
export type EmailProvider = "sendgrid" | "brevo" | "none";

export function resolveEmailProviderConfiguration(environment: NodeJS.ProcessEnv = process.env): {
  provider: EmailProvider;
  configured: boolean;
  defaultFrom: string;
  configurationError: string | null;
} {
  const providerOverride = String(environment.EMAIL_PROVIDER || "")
    .toLowerCase()
    .trim();
  const sendgridApiKey = String(environment.SENDGRID_API_KEY || "").trim();
  const brevoApiKey = String(environment.BREVO_API_KEY || "").trim();

  let provider: EmailProvider;
  if (providerOverride === "sendgrid") {
    provider = sendgridApiKey ? "sendgrid" : "none";
  } else if (providerOverride === "brevo") {
    provider = brevoApiKey ? "brevo" : "none";
  } else {
    provider = sendgridApiKey ? "sendgrid" : brevoApiKey ? "brevo" : "none";
  }

  const sharedFrom = String(environment.DEFAULT_FROM_EMAIL || "").trim();
  const defaultFrom =
    provider === "sendgrid"
      ? String(environment.SENDGRID_FROM_EMAIL || sharedFrom).trim()
      : provider === "brevo"
        ? String(environment.BREVO_FROM_EMAIL || sharedFrom).trim()
        : sharedFrom;

  let configurationError: string | null = null;
  if (provider === "none") {
    if (providerOverride === "sendgrid" && !sendgridApiKey) {
      configurationError = "SENDGRID_API_KEY_MISSING";
    } else if (providerOverride === "brevo" && !brevoApiKey) {
      configurationError = "BREVO_API_KEY_MISSING";
    } else {
      configurationError = "EMAIL_PROVIDER_NOT_CONFIGURED";
    }
  } else if (!defaultFrom) {
    configurationError =
      provider === "sendgrid" ? "SENDGRID_FROM_EMAIL_MISSING" : "BREVO_FROM_EMAIL_MISSING";
  }

  return {
    provider,
    configured: provider !== "none" && !configurationError,
    defaultFrom,
    configurationError,
  };
}

export function isEmailPurposeAllowedForMode(mode: EmailMode, rawPurpose: unknown): boolean {
  if (mode === "all") return true;

  const purpose = String(rawPurpose || "")
    .toLowerCase()
    .trim();

  return (
    purpose === "account_creation" ||
    purpose === "email_verification" ||
    purpose === "activation" ||
    purpose === "claim_business" ||
    purpose === "direct_connect_account_setup" ||
    purpose === "direct_connect_request" ||
    purpose === "direct_connect_admin_oversight" ||
    purpose === "tradepartner_interest_admin" ||
    purpose === "tradepartner_rsvp_admin" ||
    purpose === "tradepartner_rsvp_confirmation" ||
    purpose === "tradepartner_request_notification" ||
    purpose === "property_participant_invite"
  );
}

class EmailService {
  private configured: boolean;
  private provider: EmailProvider;
  private defaultFrom: string;
  private configurationError: string | null;
  private brevoApiKey: string | undefined;
  private mode: EmailMode;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;
    const providerConfiguration = resolveEmailProviderConfiguration();
    this.provider = providerConfiguration.provider;
    this.configured = providerConfiguration.configured;
    this.defaultFrom = providerConfiguration.defaultFrom;
    this.configurationError = providerConfiguration.configurationError;

    this.brevoApiKey = brevoApiKey;

    if (this.provider === "sendgrid" && apiKey) {
      sgMail.setApiKey(apiKey);
    }

    if (this.configurationError && this.provider !== "none") {
      console.error("[email] Provider configuration is incomplete", {
        provider: this.provider,
        configurationError: this.configurationError,
      });
    }

    const modeRaw = String(process.env.EMAIL_MODE || "all")
      .toLowerCase()
      .trim();
    this.mode = modeRaw === "account_creation_only" ? "account_creation_only" : "all";
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getDiagnostics(): {
    configured: boolean;
    provider: "sendgrid" | "brevo" | "none";
    mode: "all" | "account_creation_only";
    defaultFrom: string;
    configurationError: string | null;
  } {
    return {
      configured: this.configured,
      provider: this.provider,
      mode: this.mode,
      defaultFrom: this.defaultFrom,
      configurationError: this.configurationError,
    };
  }

  async sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
    if (!this.configured) {
      console.warn("[email] Email provider not configured; skipping send");
      return {
        skipped: true,
        provider: this.provider,
        skippedReason: this.configurationError?.endsWith("_FROM_EMAIL_MISSING")
          ? "sender_not_configured"
          : "provider_not_configured",
      };
    }

    if (!isEmailPurposeAllowedForMode(this.mode, params.purpose)) {
      console.warn("[email] Suppressed by EMAIL_MODE=account_creation_only", {
        purpose: params.purpose,
        subject: params.subject,
      });
      return {
        skipped: true,
        provider: this.provider,
        skippedReason: "email_mode_suppressed",
      };
    }

    if (!params.html && !params.text) {
      throw new Error("Email requires html or text content");
    }

    const from =
      typeof params.from === "object" && params.from
        ? params.from
        : { email: params.from || this.defaultFrom };

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

      const [response] = await sgMail.send(payload);
      const messageId = (response?.headers as any)?.["x-message-id"];

      return {
        skipped: false,
        provider: this.provider,
        messageId: Array.isArray(messageId) ? messageId[0] : messageId,
      };
    }

    if (this.provider === "brevo") {
      if (!this.brevoApiKey) {
        console.warn("[email] Brevo selected but BREVO_API_KEY missing; skipping send");
        return {
          skipped: true,
          provider: this.provider,
          skippedReason: "provider_not_configured",
        };
      }
      const fetchFn = (globalThis as any).fetch as undefined | typeof fetch;
      if (!fetchFn) {
        throw new Error("Brevo email requires global fetch() (Node 18+)");
      }

      const toList = Array.isArray(params.to) ? params.to : [params.to];
      const payload = {
        sender: from.name ? { email: from.email, name: from.name } : { email: from.email },
        to: toList.map((email) => ({ email })),
        subject: params.subject,
        ...(params.html ? { htmlContent: params.html } : {}),
        ...(params.text ? { textContent: params.text } : {}),
        ...(params.cc?.length ? { cc: params.cc.map((email) => ({ email })) } : {}),
        ...(params.bcc?.length ? { bcc: params.bcc.map((email) => ({ email })) } : {}),
        ...(params.replyTo ? { replyTo: { email: params.replyTo } } : {}),
        ...(params.headers ? { headers: params.headers } : {}),
      };

      const resp = await fetchFn("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": this.brevoApiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Brevo send failed (${resp.status}): ${text || resp.statusText}`);
      }

      const json: any = await resp.json().catch(() => null);
      const messageId = json?.messageId || json?.["messageId"];
      return {
        skipped: false,
        provider: this.provider,
        messageId: typeof messageId === "string" ? messageId : undefined,
      };
    }

    // Should never happen, but fail-soft.
    console.warn("[email] Unknown provider; skipping send");
    return {
      skipped: true,
      provider: this.provider,
      skippedReason: "provider_not_configured",
    };
  }
}

export const emailService = new EmailService();
