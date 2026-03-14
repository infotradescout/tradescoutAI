import { Router, type Request, type Response } from "express";
import { pool } from "../db/pg";
import { ensureTradePartnerTables } from "../db/ensureTradePartnerTables";
import { emailService } from "../services/emailService";

const router = Router();

const EVENT_LABEL = "TradeScout x Cumulus Media Lunch + Local Business Meetup";

const RSVP_COUNTIES: Record<string, string> = {
  "mobile-county-al": "Mobile County, AL",
  "escambia-county-fl": "Escambia County, FL",
  "okaloosa-county-fl": "Okaloosa County, FL",
};

function cleanString(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function parsePositiveInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function parseMeetingDate(value: unknown): string {
  const normalized = cleanString(value, 32);
  if (!normalized) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  return normalized;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseRecipientList(value: string): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function userText(user: Record<string, unknown>, key: string, maxLen: number): string {
  return cleanString(user[key], maxLen);
}

router.post("/", async (req: Request, res: Response) => {
  const partnerSlug = cleanString(req.body?.partnerSlug, 120).toLowerCase() || "cumulus-media";
  const countySlug = cleanString(req.body?.countySlug, 80).toLowerCase();
  let countyLabel = RSVP_COUNTIES[countySlug];

  if (!countySlug || !countyLabel) {
    return res.status(400).json({ error: "Please select a supported county meeting." });
  }

  const meetingDate = parseMeetingDate(req.body?.meetingDate);
  if (!meetingDate) {
    return res.status(400).json({ error: "Please select a valid meeting date." });
  }
  const meetingId = cleanString(req.body?.meetingId, 120).toLowerCase();
  const timeLabel = cleanString(req.body?.timeLabel, 40);
  const startDateTime = cleanString(req.body?.startDateTime, 80);

  const sessionUser = ((req.user || {}) as Record<string, unknown>) || {};
  const userFirstName = userText(sessionUser, "firstName", 80);
  const userLastName = userText(sessionUser, "lastName", 80);
  const userDisplayName = [userFirstName, userLastName].filter(Boolean).join(" ").trim();
  const userEmail = userText(sessionUser, "email", 200).toLowerCase();
  const userPhone = userText(sessionUser, "phone", 60);
  const userBusinessName =
    userText(sessionUser, "businessName", 160) || userText(sessionUser, "company", 160);

  const businessNameInput = cleanString(req.body?.businessName, 160);
  const contactNameInput = cleanString(req.body?.contactName, 120);
  const emailInput = cleanString(req.body?.email, 200).toLowerCase();

  const businessName =
    businessNameInput || userBusinessName || userDisplayName || "TradeScout Member";
  const contactName = contactNameInput || userDisplayName || businessName;
  const email = emailInput || userEmail;
  const phone = cleanString(req.body?.phone, 60) || userPhone;
  const notes = cleanString(req.body?.notes, 2000);

  if (!businessName || !contactName) {
    return res.status(400).json({ error: "Business name and contact name are required." });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  const attendeeCount = parsePositiveInteger(req.body?.attendeeCount, 1, 1, 12);
  const lunchAttendees = parsePositiveInteger(req.body?.lunchAttendees, attendeeCount, 1, 12);

  const userAgent = cleanString(req.headers["user-agent"], 300);
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const ipAddress = cleanString(forwardedFor || req.ip, 80);

  const insertQuery = `
    INSERT INTO tradepartner_rsvp_submissions (
      partner_slug,
      county_slug,
      county_label,
      event_label,
      meeting_id,
      meeting_date,
      time_label,
      start_datetime,
      business_name,
      contact_name,
      contact_email,
      contact_phone,
      attendee_count,
      lunch_attendees,
      notes,
      user_agent,
      ip_address
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING id
  `;

  try {
    await ensureTradePartnerTables();
    const meetingLookup = await pool.query(
      `
      SELECT county_label, event_label
           , time_label
           , start_datetime
      FROM tradepartner_campaign_meetings
      WHERE partner_slug = $1
        AND county_slug = $2
        AND (
          ($3 <> '' AND meeting_id = $3)
          OR ($3 = '' AND meeting_date = $4::date)
        )
        AND is_active = TRUE
      LIMIT 1
      `,
      [partnerSlug, countySlug, meetingId, meetingDate]
    );

    if (meetingLookup.rows.length > 0) {
      const row = meetingLookup.rows[0] as Record<string, unknown>;
      countyLabel = cleanString(row.county_label, 120) || countyLabel;
    } else if (!countyLabel) {
      return res.status(400).json({ error: "Please select a supported county meeting." });
    }

    const eventLabelFromMeeting =
      cleanString((meetingLookup.rows[0] as any)?.event_label, 220) || EVENT_LABEL;

    const insertResult = await pool.query(insertQuery, [
      partnerSlug,
      countySlug,
      countyLabel,
      eventLabelFromMeeting,
      meetingId || null,
      meetingDate,
      timeLabel || cleanString((meetingLookup.rows[0] as any)?.time_label, 40) || null,
      startDateTime || (meetingLookup.rows[0] as any)?.start_datetime || null,
      businessName,
      contactName,
      email,
      phone || null,
      attendeeCount,
      lunchAttendees,
      notes || null,
      userAgent || null,
      ipAddress || null,
    ]);

    const recipientEnv =
      process.env.TRADEPARTNER_RSVP_EMAIL ||
      process.env.TRADEPARTNER_INTEREST_EMAIL ||
      process.env.ADMIN_EMAIL ||
      process.env.MASTER_ADMIN_EMAIL ||
      "";
    const recipients = parseRecipientList(recipientEnv);

    if (emailService.isConfigured() && recipients.length > 0) {
      const safeCounty = escapeHtml(countyLabel);
      const safeMeetingDate = escapeHtml(meetingDate);
      const safeBusiness = escapeHtml(businessName);
      const safeContact = escapeHtml(contactName);
      const safeEmail = escapeHtml(email);
      const safePhone = escapeHtml(phone || "Not provided");
      const safeNotes = escapeHtml(notes || "No notes provided").replace(/\n/g, "<br>");

      void emailService
        .sendEmail({
          to: recipients,
          subject: `New TradePartner RSVP: ${businessName} (${countyLabel})`,
          html: `<h2>New TradePartner RSVP</h2>
<p><strong>Partner:</strong> ${escapeHtml(partnerSlug)}</p>
<p><strong>County meeting:</strong> ${safeCounty}</p>
<p><strong>Meeting date:</strong> ${safeMeetingDate}</p>
<p><strong>Business:</strong> ${safeBusiness}</p>
<p><strong>Contact:</strong> ${safeContact}</p>
<p><strong>Email:</strong> ${safeEmail}</p>
<p><strong>Phone:</strong> ${safePhone}</p>
<p><strong>Attendee count:</strong> ${attendeeCount}</p>
<p><strong>Lunch seats:</strong> ${lunchAttendees}</p>
<p><strong>Notes:</strong><br>${safeNotes}</p>`,
          text: [
            "New TradePartner RSVP",
            `Partner: ${partnerSlug}`,
            `County meeting: ${countyLabel}`,
            `Meeting date: ${meetingDate}`,
            `Business: ${businessName}`,
            `Contact: ${contactName}`,
            `Email: ${email}`,
            `Phone: ${phone || "Not provided"}`,
            `Attendee count: ${attendeeCount}`,
            `Lunch seats: ${lunchAttendees}`,
            `Notes: ${notes || "No notes provided"}`,
          ].join("\n"),
          purpose: "tradepartner_rsvp_admin",
        })
        .catch((emailError) => {
          console.error("TradePartner RSVP email notification failed:", emailError);
        });
    }

    return res.json({ ok: true, rsvpId: insertResult.rows[0]?.id });
  } catch (error) {
    console.error("POST tradepartner RSVP error:", error);
    const code = String((error as { code?: unknown })?.code || "");
    if (code === "42P01") {
      return res.status(503).json({ error: "RSVP storage is not configured yet." });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
