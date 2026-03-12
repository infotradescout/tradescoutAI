import { pool } from "../db";

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS tradepartner_county_pages (
  id BIGSERIAL PRIMARY KEY,
  county_slug TEXT NOT NULL UNIQUE,
  county_name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  page_title TEXT NOT NULL,
  hero_headline TEXT NOT NULL,
  hero_subhead TEXT NOT NULL,
  seat_term_months INTEGER NOT NULL DEFAULT 12,
  giveback_seat_revenue_pct INTEGER NOT NULL DEFAULT 50,
  county_vault_affiliate_pct INTEGER NOT NULL DEFAULT 10,
  allowed_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tradepartner_interest_submissions (
  id BIGSERIAL PRIMARY KEY,
  county_slug TEXT NOT NULL,
  business_name TEXT NOT NULL,
  service_category TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  acknowledges_exclusivity BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledges_term BOOLEAN NOT NULL DEFAULT FALSE,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tradepartner_interest_county_slug
  ON tradepartner_interest_submissions(county_slug);

CREATE INDEX IF NOT EXISTS idx_tradepartner_interest_created_at
  ON tradepartner_interest_submissions(created_at);

CREATE TABLE IF NOT EXISTS tradepartner_rsvp_submissions (
  id BIGSERIAL PRIMARY KEY,
  partner_slug TEXT NOT NULL,
  county_slug TEXT NOT NULL,
  county_label TEXT NOT NULL,
  event_label TEXT NOT NULL,
  meeting_date DATE,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  attendee_count INTEGER NOT NULL DEFAULT 1,
  lunch_attendees INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS meeting_date DATE;

CREATE INDEX IF NOT EXISTS idx_tradepartner_rsvp_partner_county
  ON tradepartner_rsvp_submissions(partner_slug, county_slug);

CREATE INDEX IF NOT EXISTS idx_tradepartner_rsvp_created_at
  ON tradepartner_rsvp_submissions(created_at);

CREATE TABLE IF NOT EXISTS tradepartner_campaigns (
  partner_slug TEXT PRIMARY KEY,
  partner_name TEXT NOT NULL,
  campaign_title TEXT NOT NULL,
  hero_kicker TEXT NOT NULL DEFAULT 'TradePartner Campaign',
  hero_headline TEXT NOT NULL,
  hero_subhead TEXT NOT NULL,
  deal_amount_usd INTEGER NOT NULL DEFAULT 2000,
  deal_terms TEXT NOT NULL DEFAULT 'No catch. No minimum spend. No hidden terms.',
  coverage_scope TEXT NOT NULL DEFAULT 'national',
  focus_note TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT 'Choose meeting date',
  cta_url TEXT,
  seo_keywords TEXT,
  benefits_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tradepartner_campaign_focus_counties (
  partner_slug TEXT NOT NULL REFERENCES tradepartner_campaigns(partner_slug) ON DELETE CASCADE,
  county_slug TEXT NOT NULL,
  county_name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  local_focus TEXT NOT NULL DEFAULT '',
  neighborhoods_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (partner_slug, county_slug)
);

CREATE INDEX IF NOT EXISTS idx_tradepartner_campaign_focus_counties_partner
  ON tradepartner_campaign_focus_counties(partner_slug, sort_order, county_slug);

CREATE TABLE IF NOT EXISTS tradepartner_campaign_meetings (
  id BIGSERIAL PRIMARY KEY,
  partner_slug TEXT NOT NULL REFERENCES tradepartner_campaigns(partner_slug) ON DELETE CASCADE,
  meeting_id TEXT NOT NULL,
  county_slug TEXT NOT NULL,
  county_label TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  date_label TEXT NOT NULL,
  teaser TEXT NOT NULL DEFAULT '',
  event_label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_slug, meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_tradepartner_campaign_meetings_partner
  ON tradepartner_campaign_meetings(partner_slug, county_slug, meeting_date);
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureTradePartnerTables() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(TABLE_DDL);
      await pool.query(`
        INSERT INTO tradepartner_campaigns (
          partner_slug,
          partner_name,
          campaign_title,
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
          is_active
        )
        VALUES (
          'cumulus-media',
          'Cumulus Media',
          'TradeScout x Cumulus Media',
          'TradeScout x Cumulus Media',
          'Cumulus Media is providing an unconditional $2,000 in free ads to the TradeScout network. No catch. No minimum spend. No hidden terms.',
          2000,
          'Unconditional $2,000 ad credit. No catch, no minimum, no purchase required.',
          'national',
          'Offer applies across Cumulus markets. Current launch focus: Mobile County AL, Escambia County FL, and Okaloosa County FL.',
          'Choose meeting date',
          '/tradepartners/cumulus-media?rsvp=1',
          'TradeScout, Cumulus Media, free ads, local business marketing, Mobile County AL marketing, Escambia County FL marketing, Okaloosa County FL marketing, county business meetup, TradePartner, Westwood One',
          '[
            "Unconditional $2,000 in free ads for the TradeScout network.",
            "Local radio reach plus strategic amplification across digital channels.",
            "One of the largest audio footprints in the U.S. market.",
            "Westwood One network access for broader regional and national campaign options.",
            "County-level campaign planning tailored to local business demand.",
            "Creative support and messaging help from experienced Cumulus teams.",
            "Brand credibility through trusted local personalities and station audiences.",
            "Integrated campaign options across on-air, stream, podcast, and digital touchpoints."
          ]'::jsonb,
          TRUE
        )
        ON CONFLICT (partner_slug) DO NOTHING;

        INSERT INTO tradepartner_campaign_focus_counties (
          partner_slug, county_slug, county_name, state_code, local_focus, neighborhoods_json, sort_order, is_active
        )
        VALUES
          (
            'cumulus-media',
            'mobile-county-al',
            'Mobile County',
            'AL',
            'Gulf Coast service businesses, home services, and local retail growth campaigns.',
            '["Mobile","Daphne","Fairhope","Saraland"]'::jsonb,
            10,
            TRUE
          ),
          (
            'cumulus-media',
            'escambia-county-fl',
            'Escambia County',
            'FL',
            'Pensacola-area local business awareness, direct response, and event promotion.',
            '["Pensacola","Cantonment","Gulf Breeze","Pace"]'::jsonb,
            20,
            TRUE
          ),
          (
            'cumulus-media',
            'okaloosa-county-fl',
            'Okaloosa County',
            'FL',
            'Fort Walton Beach and Destin corridor business visibility across local audiences.',
            '["Fort Walton Beach","Destin","Crestview","Niceville"]'::jsonb,
            30,
            TRUE
          )
        ON CONFLICT (partner_slug, county_slug) DO NOTHING;

        INSERT INTO tradepartner_campaign_meetings (
          partner_slug, meeting_id, county_slug, county_label, meeting_date, date_label, teaser, event_label, sort_order, is_active
        )
        VALUES
          (
            'cumulus-media',
            'mobile-2026-03-24',
            'mobile-county-al',
            'Mobile County, AL',
            DATE '2026-03-24',
            'Tuesday, March 24, 2026',
            'Gulf Coast business networking + Cumulus partnership briefing.',
            'TradeScout x Cumulus Media Lunch + Local Business Meetup',
            10,
            TRUE
          ),
          (
            'cumulus-media',
            'escambia-2026-03-25',
            'escambia-county-fl',
            'Escambia County, FL',
            DATE '2026-03-25',
            'Wednesday, March 25, 2026',
            'Regional lunch meetup focused on local growth planning.',
            'TradeScout x Cumulus Media Lunch + Local Business Meetup',
            20,
            TRUE
          ),
          (
            'cumulus-media',
            'okaloosa-2026-03-26',
            'okaloosa-county-fl',
            'Okaloosa County, FL',
            DATE '2026-03-26',
            'Thursday, March 26, 2026',
            'County-wide workshop with Cumulus corporate partners.',
            'TradeScout x Cumulus Media Lunch + Local Business Meetup',
            30,
            TRUE
          )
        ON CONFLICT (partner_slug, meeting_id) DO NOTHING;
      `);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  await ensurePromise;
}
