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
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureTradePartnerTables() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(TABLE_DDL);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  await ensurePromise;
}
