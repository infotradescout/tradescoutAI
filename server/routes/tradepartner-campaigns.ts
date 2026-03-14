import type { Request, Response } from "express";
import { pool } from "../db/pg";
import { ensureTradePartnerTables } from "../db/ensureTradePartnerTables";

type CampaignCounty = {
  countySlug: string;
  countyName: string;
  stateCode: string;
  localFocus: string;
  neighborhoods: string[];
  sortOrder: number;
};

type CampaignMeeting = {
  meetingId: string;
  countySlug: string;
  countyLabel: string;
  meetingCity: string;
  meetingDate: string;
  dateLabel: string;
  timeLabel: string;
  startDateTime: string;
  addressLine1: string;
  addressLine2: string;
  teaser: string;
  eventLabel: string;
  sortOrder: number;
};

function cleanText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function isValidPartnerSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]+$/.test(value) && value.length <= 120;
}

function isValidCountySlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]+$/.test(value) && value.length <= 120;
}

function parseStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value.map((item) => cleanText(item, maxLen)).filter((item) => item.length > 0);
  return Array.from(new Set(normalized)).slice(0, maxItems);
}

function parseDate(value: unknown): string {
  const normalized = cleanText(value, 32);
  if (!normalized) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return "";
  return normalized;
}

function toIsoDate(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function toIsoDateTime(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString();
}

async function fetchCampaignBySlug(partnerSlug: string) {
  const campaignResult = await pool.query(
    `
      SELECT
        partner_slug,
        partner_name,
        campaign_title,
        hero_kicker,
        hero_headline,
        hero_subhead,
        deal_amount_usd,
        deal_terms,
        coverage_scope,
        focus_note,
        cta_label,
        cta_url,
        seo_keywords,
        benefits_json,
        is_active,
        created_at,
        updated_at
      FROM tradepartner_campaigns
      WHERE partner_slug = $1
      LIMIT 1
    `,
    [partnerSlug]
  );

  if (!campaignResult.rows.length) {
    return null;
  }

  const campaignRow = campaignResult.rows[0] as Record<string, unknown>;

  const countiesResult = await pool.query(
    `
      SELECT
        county_slug,
        county_name,
        state_code,
        local_focus,
        neighborhoods_json,
        sort_order
      FROM tradepartner_campaign_focus_counties
      WHERE partner_slug = $1
        AND is_active = TRUE
      ORDER BY sort_order ASC, county_slug ASC
    `,
    [partnerSlug]
  );

  const meetingsResult = await pool.query(
    `
      SELECT
        meeting_id,
        county_slug,
        county_label,
        meeting_city,
        meeting_date,
        date_label,
        time_label,
        start_datetime,
        address_line1,
        address_line2,
        teaser,
        event_label,
        sort_order
      FROM tradepartner_campaign_meetings
      WHERE partner_slug = $1
        AND is_active = TRUE
      ORDER BY sort_order ASC, meeting_date ASC
    `,
    [partnerSlug]
  );

  const counties: CampaignCounty[] = countiesResult.rows.map((row: any) => ({
    countySlug: String(row?.county_slug || ""),
    countyName: String(row?.county_name || ""),
    stateCode: String(row?.state_code || ""),
    localFocus: String(row?.local_focus || ""),
    neighborhoods: parseStringArray(row?.neighborhoods_json, 24, 80),
    sortOrder: Number(row?.sort_order || 0),
  }));

  const meetings: CampaignMeeting[] = meetingsResult.rows.map((row: any) => ({
    meetingId: String(row?.meeting_id || ""),
    countySlug: String(row?.county_slug || ""),
    countyLabel: String(row?.county_label || ""),
    meetingCity: String(row?.meeting_city || ""),
    meetingDate: toIsoDate(row?.meeting_date),
    dateLabel: String(row?.date_label || ""),
    timeLabel: String(row?.time_label || ""),
    startDateTime: toIsoDateTime(row?.start_datetime),
    addressLine1: String(row?.address_line1 || ""),
    addressLine2: String(row?.address_line2 || ""),
    teaser: String(row?.teaser || ""),
    eventLabel: String(row?.event_label || ""),
    sortOrder: Number(row?.sort_order || 0),
  }));

  return {
    partnerSlug: String(campaignRow.partner_slug || ""),
    partnerName: String(campaignRow.partner_name || ""),
    campaignTitle: String(campaignRow.campaign_title || ""),
    heroKicker: String(campaignRow.hero_kicker || "TradePartner Campaign"),
    heroHeadline: String(campaignRow.hero_headline || ""),
    heroSubhead: String(campaignRow.hero_subhead || ""),
    dealAmountUsd: Number(campaignRow.deal_amount_usd || 0),
    dealTerms: String(campaignRow.deal_terms || ""),
    coverageScope: String(campaignRow.coverage_scope || "national"),
    focusNote: String(campaignRow.focus_note || ""),
    ctaLabel: String(campaignRow.cta_label || "Choose meeting date"),
    ctaUrl: cleanText(campaignRow.cta_url, 500),
    seoKeywords: cleanText(campaignRow.seo_keywords, 2000),
    benefits: parseStringArray(campaignRow.benefits_json, 24, 220),
    isActive: campaignRow.is_active === true,
    counties,
    meetings,
    createdAt: String(campaignRow.created_at || ""),
    updatedAt: String(campaignRow.updated_at || ""),
  };
}

export async function getTradePartnerCampaignPublicHandler(req: Request, res: Response) {
  const partnerSlug = cleanText(req.params.partnerSlug, 120).toLowerCase();
  if (!isValidPartnerSlug(partnerSlug)) {
    return res.status(400).json({ error: "Invalid partner slug" });
  }

  try {
    await ensureTradePartnerTables();
    const campaign = await fetchCampaignBySlug(partnerSlug);
    if (!campaign || !campaign.isActive) {
      return res.status(404).json({ error: "Not found" });
    }
    return res.json(campaign);
  } catch (error) {
    console.error("GET tradepartner campaign error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function listTradePartnerCampaignsAdminHandler(_req: Request, res: Response) {
  try {
    await ensureTradePartnerTables();
    const result = await pool.query(
      `
      SELECT
        c.partner_slug,
        c.partner_name,
        c.campaign_title,
        c.coverage_scope,
        c.is_active,
        c.updated_at,
        COALESCE(cc.focus_count, 0) AS focus_count,
        COALESCE(cm.meeting_count, 0) AS meeting_count
      FROM tradepartner_campaigns c
      LEFT JOIN (
        SELECT partner_slug, COUNT(*)::integer AS focus_count
        FROM tradepartner_campaign_focus_counties
        WHERE is_active = TRUE
        GROUP BY partner_slug
      ) cc ON cc.partner_slug = c.partner_slug
      LEFT JOIN (
        SELECT partner_slug, COUNT(*)::integer AS meeting_count
        FROM tradepartner_campaign_meetings
        WHERE is_active = TRUE
        GROUP BY partner_slug
      ) cm ON cm.partner_slug = c.partner_slug
      ORDER BY c.partner_slug ASC
      `
    );

    const items = result.rows.map((row: any) => ({
      partnerSlug: String(row.partner_slug || ""),
      partnerName: String(row.partner_name || ""),
      campaignTitle: String(row.campaign_title || ""),
      coverageScope: String(row.coverage_scope || "national"),
      isActive: row.is_active === true,
      focusCount: Number(row.focus_count || 0),
      meetingCount: Number(row.meeting_count || 0),
      updatedAt: String(row.updated_at || ""),
    }));

    return res.json({ items });
  } catch (error) {
    console.error("LIST tradepartner campaigns error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function getTradePartnerCampaignAdminHandler(req: Request, res: Response) {
  const partnerSlug = cleanText(req.params.partnerSlug, 120).toLowerCase();
  if (!isValidPartnerSlug(partnerSlug)) {
    return res.status(400).json({ error: "Invalid partner slug" });
  }

  try {
    await ensureTradePartnerTables();
    const campaign = await fetchCampaignBySlug(partnerSlug);
    if (!campaign) {
      return res.status(404).json({ error: "Not found" });
    }
    return res.json(campaign);
  } catch (error) {
    console.error("GET admin tradepartner campaign error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}

export async function upsertTradePartnerCampaignAdminHandler(req: Request, res: Response) {
  const partnerSlug = cleanText(req.params.partnerSlug, 120).toLowerCase();
  if (!isValidPartnerSlug(partnerSlug)) {
    return res.status(400).json({ error: "Invalid partner slug" });
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const partnerName = cleanText(body.partnerName, 180);
  const campaignTitle = cleanText(body.campaignTitle, 220);
  const heroHeadline = cleanText(body.heroHeadline, 240);
  const heroSubhead = cleanText(body.heroSubhead, 1200);
  const heroKicker = cleanText(body.heroKicker, 100) || "TradePartner Campaign";
  const dealTerms = cleanText(body.dealTerms, 1200);
  const focusNote = cleanText(body.focusNote, 1200);
  const coverageScope =
    cleanText(body.coverageScope, 40).toLowerCase() === "focused"
      ? "focused"
      : cleanText(body.coverageScope, 40).toLowerCase() === "regional"
        ? "regional"
        : "national";
  const ctaLabel = cleanText(body.ctaLabel, 120) || "Choose meeting date";
  const ctaUrl = cleanText(body.ctaUrl, 500);
  const seoKeywords = cleanText(body.seoKeywords, 3000);
  const benefits = parseStringArray(body.benefits, 32, 220);
  const isActive = body.isActive !== false;

  const rawAmount = Number(body.dealAmountUsd);
  const dealAmountUsd = Number.isFinite(rawAmount) ? Math.max(0, Math.min(1000000, rawAmount)) : 0;

  const countiesRaw = Array.isArray(body.counties) ? body.counties : [];
  const counties = countiesRaw
    .map((item: any, index: number) => {
      const countySlug = cleanText(item?.countySlug, 120).toLowerCase();
      const countyName = cleanText(item?.countyName, 120);
      const stateCode = cleanText(item?.stateCode, 8).toUpperCase();
      if (!isValidCountySlug(countySlug) || !countyName || !stateCode) return null;
      return {
        countySlug,
        countyName,
        stateCode,
        localFocus: cleanText(item?.localFocus, 500),
        neighborhoods: parseStringArray(item?.neighborhoods, 24, 80),
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item?.sortOrder) : index * 10,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const meetingsRaw = Array.isArray(body.meetings) ? body.meetings : [];
  const meetings = meetingsRaw
    .map((item: any, index: number) => {
      const meetingId = cleanText(item?.meetingId, 120).toLowerCase();
      const countySlug = cleanText(item?.countySlug, 120).toLowerCase();
      const countyLabel = cleanText(item?.countyLabel, 120);
      const meetingCity = cleanText(item?.meetingCity, 120);
      const meetingDate = parseDate(item?.meetingDate);
      const dateLabel = cleanText(item?.dateLabel, 120);
      const timeLabel = cleanText(item?.timeLabel, 40);
      if (
        !meetingId ||
        !isValidCountySlug(countySlug) ||
        !countyLabel ||
        !meetingDate ||
        !dateLabel
      ) {
        return null;
      }
      return {
        meetingId,
        countySlug,
        countyLabel,
        meetingCity,
        meetingDate,
        dateLabel,
        timeLabel,
        startDateTime: cleanText(item?.startDateTime, 80),
        addressLine1: cleanText(item?.addressLine1, 160),
        addressLine2: cleanText(item?.addressLine2, 160),
        teaser: cleanText(item?.teaser, 500),
        eventLabel: cleanText(item?.eventLabel, 220),
        sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item?.sortOrder) : index * 10,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!partnerName || !campaignTitle || !heroHeadline || !heroSubhead || !dealTerms) {
    return res.status(400).json({ error: "Missing required campaign fields." });
  }

  try {
    await ensureTradePartnerTables();
    await pool.query("BEGIN");

    await pool.query(
      `
      INSERT INTO tradepartner_campaigns (
        partner_slug,
        partner_name,
        campaign_title,
        hero_kicker,
        hero_headline,
        hero_subhead,
        deal_amount_usd,
        deal_terms,
        coverage_scope,
        focus_note,
        cta_label,
        cta_url,
        seo_keywords,
        benefits_json,
        is_active,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,NOW())
      ON CONFLICT (partner_slug)
      DO UPDATE SET
        partner_name = EXCLUDED.partner_name,
        campaign_title = EXCLUDED.campaign_title,
        hero_kicker = EXCLUDED.hero_kicker,
        hero_headline = EXCLUDED.hero_headline,
        hero_subhead = EXCLUDED.hero_subhead,
        deal_amount_usd = EXCLUDED.deal_amount_usd,
        deal_terms = EXCLUDED.deal_terms,
        coverage_scope = EXCLUDED.coverage_scope,
        focus_note = EXCLUDED.focus_note,
        cta_label = EXCLUDED.cta_label,
        cta_url = EXCLUDED.cta_url,
        seo_keywords = EXCLUDED.seo_keywords,
        benefits_json = EXCLUDED.benefits_json,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      `,
      [
        partnerSlug,
        partnerName,
        campaignTitle,
        heroKicker,
        heroHeadline,
        heroSubhead,
        dealAmountUsd,
        dealTerms,
        coverageScope,
        focusNote,
        ctaLabel,
        ctaUrl || null,
        seoKeywords || null,
        JSON.stringify(benefits),
        isActive,
      ]
    );

    await pool.query(`DELETE FROM tradepartner_campaign_focus_counties WHERE partner_slug = $1`, [
      partnerSlug,
    ]);
    for (const county of counties) {
      await pool.query(
        `
          INSERT INTO tradepartner_campaign_focus_counties (
            partner_slug,
            county_slug,
            county_name,
            state_code,
            local_focus,
            neighborhoods_json,
            sort_order,
            is_active,
            updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,TRUE,NOW())
        `,
        [
          partnerSlug,
          county.countySlug,
          county.countyName,
          county.stateCode,
          county.localFocus,
          JSON.stringify(county.neighborhoods),
          county.sortOrder,
        ]
      );
    }

    await pool.query(`DELETE FROM tradepartner_campaign_meetings WHERE partner_slug = $1`, [
      partnerSlug,
    ]);
    for (const meeting of meetings) {
      await pool.query(
        `
          INSERT INTO tradepartner_campaign_meetings (
            partner_slug,
            meeting_id,
            county_slug,
            county_label,
            meeting_city,
            meeting_date,
            date_label,
            time_label,
            start_datetime,
            address_line1,
            address_line2,
            teaser,
            event_label,
            sort_order,
            is_active,
            updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9::timestamptz,$10,$11,$12,$13,$14,TRUE,NOW())
        `,
        [
          partnerSlug,
          meeting.meetingId,
          meeting.countySlug,
          meeting.countyLabel,
          meeting.meetingCity,
          meeting.meetingDate,
          meeting.dateLabel,
          meeting.timeLabel,
          meeting.startDateTime || null,
          meeting.addressLine1,
          meeting.addressLine2,
          meeting.teaser,
          meeting.eventLabel,
          meeting.sortOrder,
        ]
      );
    }

    await pool.query("COMMIT");
    const campaign = await fetchCampaignBySlug(partnerSlug);
    return res.json(campaign);
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => undefined);
    console.error("UPSERT admin tradepartner campaign error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
