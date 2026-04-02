-- SEO publication rules + public activity + prune log
-- Idempotent migration for "new & true only" discovery layer.

DO $$
BEGIN
  CREATE TYPE ts_claimed_status AS ENUM ('unclaimed', 'claimed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ts_verified_status AS ENUM ('unverified', 'verified');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ts_public_activity_type AS ENUM (
    'listing_added',
    'listing_updated',
    'claimed',
    'verified',
    'proof_added',
    'request_created_public_summary',
    'connection_made_public_summary'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE ts_seo_prune_action AS ENUM (
    'noindex',
    'removed_from_sitemap',
    'deactivated',
    'deleted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ts_publication_rules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  listing_stale_days_unclaimed integer NOT NULL,
  listing_stale_days_claimed_unverified integer NOT NULL,
  listing_stale_days_verified integer NOT NULL,
  request_public_summary_ttl_hours integer NOT NULL,
  category_page_recency_window_days integer NOT NULL,
  proof_media_ttl_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed a single canonical rules row (real defaults).
INSERT INTO ts_publication_rules (
  id,
  listing_stale_days_unclaimed,
  listing_stale_days_claimed_unverified,
  listing_stale_days_verified,
  request_public_summary_ttl_hours,
  category_page_recency_window_days,
  proof_media_ttl_days
)
SELECT
  'default',
  365,
  180,
  730,
  72,
  90,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM ts_publication_rules WHERE id = 'default');

CREATE TABLE IF NOT EXISTS ts_seo_prune_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type varchar(64) NOT NULL,
  entity_id varchar(255) NOT NULL,
  action ts_seo_prune_action NOT NULL,
  reason text NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ts_seo_prune_log_entity_idx
  ON ts_seo_prune_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ts_seo_prune_log_happened_at_idx
  ON ts_seo_prune_log(happened_at);

CREATE TABLE IF NOT EXISTS ts_public_activity (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  county_id varchar REFERENCES counties(id) ON DELETE SET NULL,
  city_slug varchar(128),
  state_code varchar(2),
  trade_slug varchar(128),
  business_id varchar REFERENCES businesses(id) ON DELETE SET NULL,
  activity_type ts_public_activity_type NOT NULL,
  occurred_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  public_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  active_status boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS ts_public_activity_county_occurred_idx
  ON ts_public_activity(county_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ts_public_activity_city_occurred_idx
  ON ts_public_activity(city_slug, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ts_public_activity_trade_occurred_idx
  ON ts_public_activity(trade_slug, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ts_public_activity_expires_idx
  ON ts_public_activity(expires_at);

-- Discovery-layer toggle: allows prune job to deactivate public crawlability without deleting data.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS public_discovery_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS businesses_public_discovery_idx
  ON businesses(public_discovery_enabled);

