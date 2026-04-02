-- Tool discovery persistence tables for Scout institutional intelligence.
-- This migration is idempotent and safe to run on partially-initialized environments.

DO $$
BEGIN
  CREATE TYPE tool_proposal_status AS ENUM (
    'proposed',
    'approved',
    'rejected',
    'deferred',
    'merged'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE evidence_source_type AS ENUM (
    'conversation',
    'action',
    'regret'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tool_proposals (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fingerprint varchar(255) NOT NULL UNIQUE,
  title varchar(255) NOT NULL,
  problem_statement text NOT NULL,
  status tool_proposal_status NOT NULL DEFAULT 'proposed',
  risk_score integer NOT NULL DEFAULT 0,
  impact_score integer NOT NULL DEFAULT 0,
  unique_user_count integer NOT NULL DEFAULT 0,
  total_event_count integer NOT NULL DEFAULT 0,
  approved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_proposals_status
  ON tool_proposals (status);

CREATE INDEX IF NOT EXISTS idx_tool_proposals_fingerprint
  ON tool_proposals (fingerprint);

CREATE INDEX IF NOT EXISTS idx_tool_proposals_created_at
  ON tool_proposals (created_at);

CREATE TABLE IF NOT EXISTS tool_proposal_evidence (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_id integer NOT NULL REFERENCES tool_proposals(id) ON DELETE CASCADE,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  source_type evidence_source_type NOT NULL,
  source_ref varchar(255),
  snippet text NOT NULL,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_proposal_evidence_proposal_id
  ON tool_proposal_evidence (proposal_id);

CREATE INDEX IF NOT EXISTS idx_tool_proposal_evidence_user_id
  ON tool_proposal_evidence (user_id);

CREATE INDEX IF NOT EXISTS idx_tool_proposal_evidence_created_at
  ON tool_proposal_evidence (created_at);

CREATE TABLE IF NOT EXISTS tool_proposal_decisions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  proposal_id integer NOT NULL REFERENCES tool_proposals(id) ON DELETE CASCADE,
  decided_by_user_id varchar NOT NULL REFERENCES users(id),
  decision tool_proposal_status NOT NULL,
  notes text,
  merged_into_id integer REFERENCES tool_proposals(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_proposal_decisions_proposal_id
  ON tool_proposal_decisions (proposal_id);

CREATE INDEX IF NOT EXISTS idx_tool_proposal_decisions_decided_by
  ON tool_proposal_decisions (decided_by_user_id);

CREATE INDEX IF NOT EXISTS idx_tool_proposal_decisions_created_at
  ON tool_proposal_decisions (created_at);

-- Align legacy incorrect integer user id columns (if present) to users.id varchar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tool_proposal_evidence'
      AND column_name = 'user_id'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE tool_proposal_evidence DROP CONSTRAINT IF EXISTS tool_proposal_evidence_user_id_fkey;
    ALTER TABLE tool_proposal_evidence DROP CONSTRAINT IF EXISTS tool_proposal_evidence_user_id_users_id_fk;
    ALTER TABLE tool_proposal_evidence ALTER COLUMN user_id TYPE varchar USING user_id::varchar;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tool_proposal_evidence_user_id_users_id_fk'
  ) THEN
    ALTER TABLE tool_proposal_evidence
      ADD CONSTRAINT tool_proposal_evidence_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tool_proposal_decisions'
      AND column_name = 'decided_by_user_id'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE tool_proposal_decisions DROP CONSTRAINT IF EXISTS tool_proposal_decisions_decided_by_user_id_fkey;
    ALTER TABLE tool_proposal_decisions DROP CONSTRAINT IF EXISTS tool_proposal_decisions_decided_by_user_id_users_id_fk;
    ALTER TABLE tool_proposal_decisions ALTER COLUMN decided_by_user_id TYPE varchar USING decided_by_user_id::varchar;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tool_proposal_decisions_decided_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE tool_proposal_decisions
      ADD CONSTRAINT tool_proposal_decisions_decided_by_user_id_users_id_fk
      FOREIGN KEY (decided_by_user_id) REFERENCES users(id);
  END IF;
END $$;
