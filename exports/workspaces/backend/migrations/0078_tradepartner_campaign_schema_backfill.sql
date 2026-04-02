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

CREATE TABLE IF NOT EXISTS tradepartner_rsvp_submissions (
  id BIGSERIAL PRIMARY KEY,
  partner_slug TEXT NOT NULL,
  county_slug TEXT NOT NULL,
  county_label TEXT NOT NULL,
  event_label TEXT NOT NULL,
  meeting_id TEXT,
  meeting_date DATE,
  time_label TEXT,
  start_datetime TIMESTAMPTZ,
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

CREATE TABLE IF NOT EXISTS tradepartner_campaign_meetings (
  id BIGSERIAL PRIMARY KEY,
  partner_slug TEXT NOT NULL REFERENCES tradepartner_campaigns(partner_slug) ON DELETE CASCADE,
  meeting_id TEXT NOT NULL,
  county_slug TEXT NOT NULL,
  county_label TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  date_label TEXT NOT NULL,
  meeting_city TEXT NOT NULL DEFAULT '',
  time_label TEXT NOT NULL DEFAULT '',
  start_datetime TIMESTAMPTZ,
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  teaser TEXT NOT NULL DEFAULT '',
  event_label TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_slug, meeting_id)
);

ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS meeting_date DATE;
ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS meeting_id TEXT;
ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS time_label TEXT;
ALTER TABLE tradepartner_rsvp_submissions
  ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ;

ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS hero_kicker TEXT NOT NULL DEFAULT 'TradePartner Campaign';
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS hero_headline TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS hero_subhead TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS deal_amount_usd INTEGER NOT NULL DEFAULT 2000;
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS deal_terms TEXT NOT NULL DEFAULT 'No catch. No minimum spend. No hidden terms.';
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS coverage_scope TEXT NOT NULL DEFAULT 'national';
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS focus_note TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS cta_label TEXT NOT NULL DEFAULT 'Choose meeting date';
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS cta_url TEXT;
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS seo_keywords TEXT;
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS benefits_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tradepartner_campaigns
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE tradepartner_campaign_focus_counties
  ADD COLUMN IF NOT EXISTS local_focus TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaign_focus_counties
  ADD COLUMN IF NOT EXISTS neighborhoods_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tradepartner_campaign_focus_counties
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tradepartner_campaign_focus_counties
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tradepartner_campaign_focus_counties
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tradepartner_campaign_focus_counties
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS meeting_city TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS time_label TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ;
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS address_line1 TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS address_line2 TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS teaser TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS event_label TEXT NOT NULL DEFAULT '';
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tradepartner_campaign_meetings
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_tradepartner_interest_county_slug
  ON tradepartner_interest_submissions(county_slug);

CREATE INDEX IF NOT EXISTS idx_tradepartner_interest_created_at
  ON tradepartner_interest_submissions(created_at);

CREATE INDEX IF NOT EXISTS idx_tradepartner_rsvp_partner_county
  ON tradepartner_rsvp_submissions(partner_slug, county_slug);

CREATE INDEX IF NOT EXISTS idx_tradepartner_rsvp_created_at
  ON tradepartner_rsvp_submissions(created_at);

CREATE INDEX IF NOT EXISTS idx_tradepartner_campaign_focus_counties_partner
  ON tradepartner_campaign_focus_counties(partner_slug, sort_order, county_slug);

CREATE INDEX IF NOT EXISTS idx_tradepartner_campaign_meetings_partner
  ON tradepartner_campaign_meetings(partner_slug, county_slug, meeting_date);
