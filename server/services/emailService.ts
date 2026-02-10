import type { MailDataRequired } from "@sendgrid/mail";
import sgMail from "@sendgrid/mail";

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  headers?: Record<string, string>;
  /** Optional classifier so we can selectively suppress emails by env */
  purpose?: string;
};

class EmailService {
  private configured: boolean;
  private provider: "sendgrid" | "brevo" | "none";
  private defaultFrom: string;
  private brevoApiKey: string | undefined;
  private mode: "all" | "account_creation_only";

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;

    this.provider = apiKey ? "sendgrid" : brevoApiKey ? "brevo" : "none";
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
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendEmail(params: SendEmailParams): Promise<{ skipped: boolean; messageId?: string }> {
    if (!this.configured) {
      console.warn("[email] Email provider not configured; skipping send");
      return { skipped: true };
    }

    if (this.mode === "account_creation_only") {
      const purpose = String(params.purpose || "")
        .toLowerCase()
        .trim();
      const allowed =
        purpose === "account_creation" ||
        purpose === "email_verification" ||
        purpose === "activation" ||
        purpose === "claim_business";
      if (!allowed) {
        console.warn("[email] Suppressed by EMAIL_MODE=account_creation_only", {
          purpose: params.purpose,
          subject: params.subject,
        });
        return { skipped: true };
      }
    }

    if (!params.html && !params.text) {
      throw new Error("Email requires html or text content");
    }

    if (this.provider === "sendgrid") {
      const content = [];
      if (params.html) content.push({ type: "text/html", value: params.html });
      if (params.text) content.push({ type: "text/plain", value: params.text });

      const payload: MailDataRequired = {
        to: params.to,
        from: params.from || this.defaultFrom,
        subject: params.subject,
        content: content as any,
        cc: params.cc,
        bcc: params.bcc,
        replyTo: params.replyTo,
        headers: params.headers,
      };

      const [response] = await sgMail.send(payload);
      const messageId = (response?.headers as any)?.["x-message-id"];

      return { skipped: false, messageId: Array.isArray(messageId) ? messageId[0] : messageId };
    }

    if (this.provider === "brevo") {
      if (!this.brevoApiKey) {
        console.warn("[email] Brevo selected but BREVO_API_KEY missing; skipping send");
        return { skipped: true };
      }
      const fetchFn = (globalThis as any).fetch as undefined | typeof fetch;
      if (!fetchFn) {
        throw new Error("Brevo email requires global fetch() (Node 18+)");
      }

      const toList = Array.isArray(params.to) ? params.to : [params.to];
      const payload = {
        sender: { email: params.from || this.defaultFrom },
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
      return { skipped: false, messageId: typeof messageId === "string" ? messageId : undefined };
    }

    // Should never happen, but fail-soft.
    console.warn("[email] Unknown provider; skipping send");
    return { skipped: true };
  }
}

export const emailService = new EmailService();
