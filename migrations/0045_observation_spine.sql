-- Phase 0A: Canonical Observation Spine
-- Adds:
-- - observations (single normalized intake model)
-- - observation_sources (adapter health/cursor tracking)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE observation_subject_type AS ENUM (
    'property',
    'business',
    'road',
    'area',
    'org',
    'person_unknown',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE observation_source_type AS ENUM (
    'permit',
    'inspection',
    'enforcement',
    'agenda',
    'ordinance',
    'sensor',
    'listing',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE observation_confidence AS ENUM (
    'official',
    'inferred'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE observation_health_status AS ENUM (
    'healthy',
    'degraded',
    'failing',
    'idle'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "observations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "occurred_at" timestamp NOT NULL,
  "county_fips" varchar(5) NOT NULL REFERENCES "counties"("fips") ON DELETE RESTRICT,
  "state_code" varchar(2) NOT NULL REFERENCES "states"("code") ON DELETE RESTRICT,
  "city" varchar(120),
  "geo_json" jsonb,
  "subject_type" observation_subject_type NOT NULL,
  "subject_ref" varchar(255),
  "action_type" varchar(64) NOT NULL,
  "source_type" observation_source_type NOT NULL,
  "source_ref" varchar(255) NOT NULL,
  "attributes_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "confidence" observation_confidence NOT NULL DEFAULT 'official',
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_observations_source_ref"
  ON "observations" ("source_type", "source_ref");
CREATE INDEX IF NOT EXISTS "idx_observations_county_occurred"
  ON "observations" ("county_fips", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_observations_source_occurred"
  ON "observations" ("source_type", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_observations_action_occurred"
  ON "observations" ("action_type", "occurred_at");

CREATE TABLE IF NOT EXISTS "observation_sources" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_type" observation_source_type NOT NULL,
  "county_fips" varchar(5) NOT NULL REFERENCES "counties"("fips") ON DELETE RESTRICT,
  "state_code" varchar(2) NOT NULL REFERENCES "states"("code") ON DELETE RESTRICT,
  "last_success_at" timestamp,
  "last_run_at" timestamp,
  "cursor_json" jsonb,
  "health_status" observation_health_status NOT NULL DEFAULT 'idle',
  "error_message" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_observation_sources_type_county"
  ON "observation_sources" ("source_type", "county_fips");
CREATE INDEX IF NOT EXISTS "idx_observation_sources_health"
  ON "observation_sources" ("health_status");
CREATE INDEX IF NOT EXISTS "idx_observation_sources_county"
  ON "observation_sources" ("county_fips");
