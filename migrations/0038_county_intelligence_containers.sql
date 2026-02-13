-- County intelligence containers (required platform law)
-- Counties are operational containers; intelligence snapshots live in:
-- - county_metrics (facts)
-- - county_entities (assignments) (already exists in some DBs)
-- - county_notes (human context)

-- Ensure pgcrypto for gen_random_uuid() defaults.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum for county_notes category (mirrors shared/schema.ts)
DO $$
BEGIN
  CREATE TYPE county_note_category AS ENUM (
    'affiliate',
    'employee',
    'partner',
    'operations',
    'risk',
    'general'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admin-only county notes (operational memory)
CREATE TABLE IF NOT EXISTS "county_notes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "county_fips" varchar(5) NOT NULL REFERENCES "counties"("fips") ON DELETE RESTRICT,
  "author_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category" county_note_category NOT NULL DEFAULT 'general',
  "content" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "county_notes_fips_idx" ON "county_notes" ("county_fips");
CREATE INDEX IF NOT EXISTS "county_notes_author_idx" ON "county_notes" ("author_user_id");

-- Precomputed numeric metrics per county (jobs write; UI reads)
CREATE TABLE IF NOT EXISTS "county_metrics" (
  "county_fips" varchar(5) NOT NULL REFERENCES "counties"("fips") ON DELETE RESTRICT,
  "metric_key" varchar(64) NOT NULL,
  "metric_value" numeric(20, 4) NOT NULL DEFAULT 0,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("county_fips", "metric_key")
);

CREATE INDEX IF NOT EXISTS "county_metrics_fips_idx" ON "county_metrics" ("county_fips");

