-- Phase 0 foundation for Property Lifecycle OS.
-- Unified support for build, existing-home onboarding, upgrades, maintenance, and sell readiness.

CREATE TABLE IF NOT EXISTS property_programs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  primary_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  county_fips VARCHAR(5) NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  mode VARCHAR NOT NULL CHECK (mode IN ('build', 'existing')),
  status VARCHAR NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  address_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  parcel_id TEXT,
  property_type VARCHAR,
  year_built INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_programs_owner ON property_programs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_property_programs_primary ON property_programs(primary_user_id);
CREATE INDEX IF NOT EXISTS idx_property_programs_county_state ON property_programs(county_fips, state_code);

CREATE TABLE IF NOT EXISTS property_participants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_program_id VARCHAR NOT NULL REFERENCES property_programs(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_role VARCHAR NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'removed')),
  invited_by_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_participants_unique_role_user
  ON property_participants(property_program_id, user_id, participant_role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_participants_single_primary_active
  ON property_participants(property_program_id)
  WHERE participant_role = 'primary' AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_property_participants_property ON property_participants(property_program_id);
CREATE INDEX IF NOT EXISTS idx_property_participants_user ON property_participants(user_id);

CREATE TABLE IF NOT EXISTS property_lifecycle_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_program_id VARCHAR NOT NULL REFERENCES property_programs(id) ON DELETE CASCADE,
  action_type VARCHAR NOT NULL,
  phase VARCHAR,
  title TEXT NOT NULL,
  description TEXT,
  occurred_at TIMESTAMP NOT NULL,
  source VARCHAR NOT NULL DEFAULT 'system' CHECK (source IN ('user', 'scout', 'integration', 'system')),
  status VARCHAR NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done', 'blocked')),
  cost_amount NUMERIC(12, 2),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_lifecycle_events_property
  ON property_lifecycle_events(property_program_id);
CREATE INDEX IF NOT EXISTS idx_property_lifecycle_events_phase_status
  ON property_lifecycle_events(property_program_id, phase, status);
CREATE INDEX IF NOT EXISTS idx_property_lifecycle_events_occurred
  ON property_lifecycle_events(occurred_at DESC);

CREATE TABLE IF NOT EXISTS property_documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_program_id VARCHAR NOT NULL REFERENCES property_programs(id) ON DELETE CASCADE,
  lifecycle_event_id VARCHAR REFERENCES property_lifecycle_events(id) ON DELETE SET NULL,
  document_type VARCHAR NOT NULL,
  file_url TEXT NOT NULL,
  checksum VARCHAR,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_documents_property ON property_documents(property_program_id);
CREATE INDEX IF NOT EXISTS idx_property_documents_event ON property_documents(lifecycle_event_id);
CREATE INDEX IF NOT EXISTS idx_property_documents_type ON property_documents(document_type);

CREATE TABLE IF NOT EXISTS property_upgrades (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_program_id VARCHAR NOT NULL REFERENCES property_programs(id) ON DELETE CASCADE,
  category VARCHAR NOT NULL,
  scope TEXT NOT NULL,
  budget_amount NUMERIC(12, 2),
  status VARCHAR NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'done', 'cancelled')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_upgrades_property ON property_upgrades(property_program_id);
CREATE INDEX IF NOT EXISTS idx_property_upgrades_status ON property_upgrades(property_program_id, status);

CREATE TABLE IF NOT EXISTS property_upgrade_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_upgrade_id VARCHAR NOT NULL REFERENCES property_upgrades(id) ON DELETE CASCADE,
  event_type VARCHAR NOT NULL,
  title TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'blocked')),
  occurred_at TIMESTAMP NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_upgrade_events_upgrade
  ON property_upgrade_events(property_upgrade_id);
CREATE INDEX IF NOT EXISTS idx_property_upgrade_events_occurred
  ON property_upgrade_events(occurred_at DESC);

-- Append-only source stream for Data Factory ingestion.
CREATE TABLE IF NOT EXISTS property_event_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR NOT NULL,
  property_program_id VARCHAR NOT NULL REFERENCES property_programs(id) ON DELETE CASCADE,
  action_type VARCHAR NOT NULL,
  actor_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR,
  county_fips VARCHAR(5),
  state_code VARCHAR(2),
  occurred_at_utc TIMESTAMP NOT NULL,
  recorded_at_utc TIMESTAMP NOT NULL DEFAULT NOW(),
  timezone VARCHAR,
  local_date DATE,
  status_before VARCHAR,
  status_after VARCHAR,
  cost_amount NUMERIC(12, 2),
  time_delta_hours NUMERIC(12, 3),
  risk_delta NUMERIC(8, 3),
  trust_snapshot_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  document_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_surface VARCHAR,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_property_event_log_idempotency
  ON property_event_log(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_property_event_log_recorded
  ON property_event_log(recorded_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_property_event_log_property
  ON property_event_log(property_program_id, occurred_at_utc DESC);

CREATE TABLE IF NOT EXISTS property_event_quarantine (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_payload JSONB NOT NULL,
  reason VARCHAR NOT NULL,
  idempotency_key VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_event_quarantine_created
  ON property_event_quarantine(created_at DESC);

CREATE TABLE IF NOT EXISTS property_pipeline_checkpoints (
  key VARCHAR PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_readiness_snapshots (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_program_id VARCHAR NOT NULL REFERENCES property_programs(id) ON DELETE CASCADE,
  readiness_score NUMERIC(5, 2) NOT NULL,
  hard_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  soft_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_best_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMP DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_property_readiness_snapshots_property
  ON property_readiness_snapshots(property_program_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS property_sell_readiness_snapshots (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_program_id VARCHAR NOT NULL REFERENCES property_programs(id) ON DELETE CASCADE,
  readiness_score NUMERIC(5, 2) NOT NULL,
  hard_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  soft_blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  packet_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMP DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_property_sell_readiness_snapshots_property
  ON property_sell_readiness_snapshots(property_program_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS property_homefax_snapshots (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  property_program_id VARCHAR NOT NULL REFERENCES property_programs(id) ON DELETE CASCADE,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMP DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_property_homefax_snapshots_property
  ON property_homefax_snapshots(property_program_id, computed_at DESC);
