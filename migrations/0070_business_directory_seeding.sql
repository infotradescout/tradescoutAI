-- Business Directory Seeding + Suggestions Queue
-- Idempotent SQL migration (safe to run multiple times).

DO $$
BEGIN
  CREATE TYPE business_suggestion_kind AS ENUM ('edit', 'removal');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE business_suggestion_status AS ENUM ('open', 'resolved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE business_seed_run_status AS ENUM ('running', 'succeeded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS business_external_refs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source varchar(64) NOT NULL,
  external_id varchar(255) NOT NULL,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE business_external_refs
    ADD CONSTRAINT business_external_refs_source_external_unique UNIQUE (source, external_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS business_external_refs_business_idx
  ON business_external_refs(business_id);

CREATE TABLE IF NOT EXISTS business_suggestions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind business_suggestion_kind NOT NULL,
  status business_suggestion_status NOT NULL DEFAULT 'open',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_suggestions_business_idx
  ON business_suggestions(business_id);
CREATE INDEX IF NOT EXISTS business_suggestions_status_idx
  ON business_suggestions(status);
CREATE INDEX IF NOT EXISTS business_suggestions_kind_idx
  ON business_suggestions(kind);

CREATE TABLE IF NOT EXISTS business_seed_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source varchar(64) NOT NULL,
  location_text text,
  county_fips varchar(5),
  state_code varchar(2),
  terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  status business_seed_run_status NOT NULL DEFAULT 'running',
  inserted_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_seed_runs_status_idx
  ON business_seed_runs(status);
CREATE INDEX IF NOT EXISTS business_seed_runs_county_idx
  ON business_seed_runs(county_fips, state_code);
CREATE INDEX IF NOT EXISTS business_seed_runs_source_idx
  ON business_seed_runs(source);

CREATE TABLE IF NOT EXISTS business_seed_run_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  seed_run_id varchar NOT NULL REFERENCES business_seed_runs(id) ON DELETE CASCADE,
  level varchar(16) NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_seed_run_logs_run_idx
  ON business_seed_run_logs(seed_run_id);
CREATE INDEX IF NOT EXISTS business_seed_run_logs_created_idx
  ON business_seed_run_logs(created_at);

