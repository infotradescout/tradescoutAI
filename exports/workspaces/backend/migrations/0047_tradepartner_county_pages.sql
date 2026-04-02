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

