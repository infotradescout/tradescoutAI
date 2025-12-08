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
};

class EmailService {
  private configured: boolean;
  private defaultFrom: string;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    this.configured = Boolean(apiKey);
    this.defaultFrom = process.env.SENDGRID_FROM_EMAIL || "noreply@tradescout.app";

    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendEmail(params: SendEmailParams): Promise<{ skipped: boolean; messageId?: string }> {
    if (!this.configured) {
      console.warn("[email] SendGrid not configured; skipping send");
      return { skipped: true };
    }

    if (!params.html && !params.text) {
      throw new Error("Email requires html or text content");
    }

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
}

export const emailService = new EmailService();
