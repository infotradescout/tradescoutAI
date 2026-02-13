-- HomeScout ingestion + timelines + precomputed market buckets (P0)
-- Keeps UI read-only for intelligence: jobs write snapshots; UI reads.

-- ---------------------------------------------------------------------------
-- Sources + ingest runs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "home_scout_sources" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_key" varchar(64) NOT NULL UNIQUE,
  "source_type" varchar(32) NOT NULL, -- json_file | json_url | mls | idx | partner | etc
  "enabled" boolean NOT NULL DEFAULT true,
  "config" jsonb NOT NULL DEFAULT '{}'::jsonb,

  "last_run_at" timestamptz,
  "last_success_at" timestamptz,
  "last_error" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_homescout_sources_enabled"
  ON "home_scout_sources" ("enabled")
  WHERE "enabled" = true;

CREATE TABLE IF NOT EXISTS "home_scout_ingest_runs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_id" varchar NOT NULL REFERENCES "home_scout_sources"("id") ON DELETE CASCADE,
  "status" varchar(16) NOT NULL DEFAULT 'running', -- running | success | error
  "stats" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "error" text
);

CREATE INDEX IF NOT EXISTS "idx_homescout_ingest_runs_source_started"
  ON "home_scout_ingest_runs" ("source_id", "started_at" DESC);

-- ---------------------------------------------------------------------------
-- Listing timeline (price history, status changes, etc)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "home_scout_listing_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "listing_id" varchar NOT NULL REFERENCES "home_scout_listings"("id") ON DELETE CASCADE,
  "event_type" varchar(32) NOT NULL, -- created | seen | price_changed | status_changed | updated
  "observed_at" timestamptz NOT NULL DEFAULT now(),
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_homescout_listing_events_listing_time"
  ON "home_scout_listing_events" ("listing_id", "observed_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_homescout_listing_events_type_time"
  ON "home_scout_listing_events" ("event_type", "observed_at" DESC);

-- ---------------------------------------------------------------------------
-- Canonical listings: add ingestion freshness + DOM helpers
-- ---------------------------------------------------------------------------

ALTER TABLE "home_scout_listings"
  ADD COLUMN IF NOT EXISTS "external_url" varchar(500),
  ADD COLUMN IF NOT EXISTS "source_updated_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "observed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "dom_days" integer;

CREATE INDEX IF NOT EXISTS "idx_homescout_source_last_seen"
  ON "home_scout_listings" ("source_key", "last_seen_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_homescout_county_status_price_changed_at"
  ON "home_scout_listings" ("county_fips", "status", "price_changed_at" DESC);

-- ---------------------------------------------------------------------------
-- Precomputed “similar homes” buckets (jobs write; UI reads)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "home_scout_market_buckets" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),

  "county_fips" varchar(5) NOT NULL REFERENCES "counties"("fips") ON DELETE RESTRICT,
  "state_code" varchar(2) NOT NULL REFERENCES "states"("code") ON DELETE RESTRICT,

  "property_type" varchar(32) NOT NULL,
  "beds_bucket" integer, -- null = any

  "active_count" integer NOT NULL DEFAULT 0,
  "median_price" numeric(12, 2),
  "median_price_per_sqft" numeric(12, 2),
  "median_dom_days" integer,
  "price_drop_count_7d" integer NOT NULL DEFAULT 0,

  "computed_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_homescout_market_bucket"
  ON "home_scout_market_buckets" ("county_fips", "state_code", "property_type", "beds_bucket");

CREATE INDEX IF NOT EXISTS "idx_homescout_market_bucket_county_type"
  ON "home_scout_market_buckets" ("county_fips", "state_code", "property_type");

