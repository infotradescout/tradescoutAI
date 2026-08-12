export const JW_STONE_EMAIL_PURPOSES = [
  "jw_stone_express_verification",
  "jw_stone_express_password_reset",
  "jw_stone_offer_confirmation",
  "jw_stone_offer_staff_alert",
  "jw_stone_offer_status",
] as const;

export type JwStoneEmailPurpose = (typeof JW_STONE_EMAIL_PURPOSES)[number];

export type JwStoneEmailTemplateInput = {
  purpose: JwStoneEmailPurpose;
  recipientName?: string | null;
  targetLabel?: string | null;
  amountCents?: number | null;
  offerStatus?: string | null;
  actionUrl?: string | null;
};

export type JwStoneEmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

function cleanText(value: unknown, fallback: string, maxLength = 180): string {
  const clean = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || fallback).slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeActionUrl(value: unknown): string | null {
  const clean = String(value ?? "").trim();
  if (!clean || clean.length > 2048) return null;
  try {
    const parsed = new URL(clean);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function formatUsd(amountCents: number | null | undefined): string {
  if (!Number.isSafeInteger(amountCents) || Number(amountCents) <= 0) return "your offer amount";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amountCents) / 100);
}

function statusLabel(value: unknown): string {
  const normalized = cleanText(value, "updated", 40).toLowerCase();
  const labels: Record<string, string> = {
    submitted: "Submitted",
    under_review: "Under review",
    accepted: "Accepted for a private follow-up",
    declined: "Declined",
    withdrawn: "Withdrawn",
    expired: "Expired",
  };
  return labels[normalized] || "Updated";
}

function render(args: {
  subject: string;
  greeting: string;
  paragraphs: string[];
  actionLabel?: string;
  actionUrl?: string | null;
}): JwStoneEmailTemplate {
  const textParts = [args.greeting, ...args.paragraphs];
  if (args.actionLabel && args.actionUrl) {
    textParts.push(`${args.actionLabel}: ${args.actionUrl}`);
  }
  textParts.push("JW Stone");

  const action =
    args.actionLabel && args.actionUrl
      ? `<p style="margin:24px 0"><a href="${escapeHtml(args.actionUrl)}" style="display:inline-block;background:#66733c;color:#fff;padding:12px 18px;text-decoration:none;font-weight:600">${escapeHtml(args.actionLabel)}</a></p>`
      : "";
  const body = args.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`)
    .join("");

  return {
    subject: args.subject,
    text: textParts.join("\n\n"),
    html: `<!doctype html><html><body style="margin:0;background:#f5f4ef;color:#20231d;font-family:Arial,sans-serif"><main style="max-width:620px;margin:0 auto;padding:32px 24px"><div style="background:#fff;border:1px solid #deddd5;padding:28px"><p style="margin:0 0 24px;color:#66733c;font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">JW Stone</p><h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:28px;font-weight:400">${escapeHtml(args.greeting)}</h1>${body}${action}<p style="margin:28px 0 0;color:#686b63;font-size:13px">Private offers are not a public auction. No competing amount, bidder, count, or rank is disclosed.</p></div></main></body></html>`,
  };
}

export function buildJwStoneEmailTemplate(input: JwStoneEmailTemplateInput): JwStoneEmailTemplate {
  const name = cleanText(input.recipientName, "there", 100);
  const target = cleanText(input.targetLabel, "your JW Stone selection", 180);
  const actionUrl = safeActionUrl(input.actionUrl);

  switch (input.purpose) {
    case "jw_stone_express_verification":
      if (!actionUrl) throw new Error("JW verification email requires a valid action URL");
      return render({
        subject: "Verify your JW Stone Express Account",
        greeting: `Hello ${name},`,
        paragraphs: [
          "Verify your email to activate the private offer captured with your JW Stone Express Account.",
          "Until verification, the offer is not active and is not visible in the JW operator queue.",
        ],
        actionLabel: "Verify email",
        actionUrl,
      });

    case "jw_stone_express_password_reset":
      if (!actionUrl) throw new Error("JW password reset email requires a valid action URL");
      return render({
        subject: "Reset your JW Stone Express password",
        greeting: `Hello ${name},`,
        paragraphs: [
          "Use this one-time link to set a new password. Completing the reset signs out every existing JW Stone Express session.",
          "If you did not request this, leave the link unused.",
        ],
        actionLabel: "Reset password",
        actionUrl,
      });

    case "jw_stone_offer_confirmation":
      return render({
        subject: `Private offer received for ${target}`,
        greeting: `Hello ${name},`,
        paragraphs: [
          `JW Stone received your private offer of ${formatUsd(input.amountCents)} for ${target}.`,
          "This confirms receipt only. It is not payment, a reservation, title transfer, or a binding sale.",
        ],
        ...(actionUrl ? { actionLabel: "View your private offer", actionUrl } : {}),
      });

    case "jw_stone_offer_staff_alert":
      if (!actionUrl) throw new Error("JW staff alert requires a valid operator URL");
      return render({
        subject: `New private JW Stone offer: ${target}`,
        greeting: "A new private offer was received.",
        paragraphs: [
          `Target: ${target}.`,
          "Open the restricted JW queue to review it. This alert intentionally omits the customer's contact details, offer amount, and priority.",
        ],
        actionLabel: "Open restricted offer queue",
        actionUrl,
      });

    case "jw_stone_offer_status":
      return render({
        subject: `JW Stone offer status: ${statusLabel(input.offerStatus)}`,
        greeting: `Hello ${name},`,
        paragraphs: [
          `Your private offer for ${target} is now: ${statusLabel(input.offerStatus)}.`,
          "An accepted status means JW Stone chose to continue a private follow-up. It is not payment, a reservation, or a binding sale.",
        ],
        ...(actionUrl ? { actionLabel: "View your private offer", actionUrl } : {}),
      });
  }
}
