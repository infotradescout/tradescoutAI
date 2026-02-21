-- Objectives + snapshots + Scout outcomes tables
-- This migration is idempotent and safe to run on baselined environments.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums for objective tracking
DO $$ BEGIN
  CREATE TYPE objective_intent_class AS ENUM (
    'unknown',
    'knowledge',
    'local_advice',
    'work_request',
    'marketplace_buy',
    'marketplace_sell',
    'community_post',
    'event',
    'safety_report',
    'account',
    'admin',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE objective_status AS ENUM (
    'active',
    'paused',
    'completed',
    'abandoned'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Objectives table
CREATE TABLE IF NOT EXISTS objectives (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  intent_class objective_intent_class DEFAULT 'unknown',
  title varchar NOT NULL,
  summary text,
  confidence numeric(3, 2) DEFAULT 0.50,
  context_json jsonb,
  source varchar DEFAULT 'scout',
  linked_object_type varchar DEFAULT 'none',
  linked_object_id varchar,
  status objective_status DEFAULT 'active',
  last_scout_message_id varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_objectives_user_id
  ON objectives (user_id);
CREATE INDEX IF NOT EXISTS idx_objectives_user_status
  ON objectives (user_id, status);
CREATE INDEX IF NOT EXISTS idx_objectives_intent_class
  ON objectives (intent_class);
CREATE INDEX IF NOT EXISTS idx_objectives_created_at
  ON objectives (created_at);
CREATE INDEX IF NOT EXISTS idx_objectives_linked_object
  ON objectives (linked_object_type, linked_object_id);

-- Objective events (append-only audit log)
CREATE TABLE IF NOT EXISTS objective_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id varchar NOT NULL,
  event_type varchar NOT NULL,
  actor_user_id varchar,
  actor_type varchar,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_objective_events_objective_id
  ON objective_events (objective_id);
CREATE INDEX IF NOT EXISTS idx_objective_events_event_type
  ON objective_events (event_type);
CREATE INDEX IF NOT EXISTS idx_objective_events_created_at
  ON objective_events (created_at);

-- Scout snapshots (dynamic identity inference)
CREATE TABLE IF NOT EXISTS snapshots (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_id varchar NOT NULL UNIQUE,
  computed_at timestamp NOT NULL DEFAULT now(),
  primary_role varchar NOT NULL,
  secondary_roles text[] DEFAULT '{}'::text[],
  primary_role_confidence numeric(3, 2) NOT NULL,
  secondary_role_confidences jsonb,
  decision_confidence varchar NOT NULL,
  signals jsonb NOT NULL,
  valid_until timestamp NOT NULL,
  confidence_decay_rate numeric(3, 2) DEFAULT 0.05,
  version varchar DEFAULT '1.0',
  experimental boolean DEFAULT false,
  tags text[] DEFAULT '{}'::text[],
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_id
  ON snapshots (user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_validity
  ON snapshots (user_id, valid_until);
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_unique_per_user
  ON snapshots (user_id, snapshot_id);

-- Enums for Scout outcome feedback loop
DO $$ BEGIN
  CREATE TYPE scout_outcome_context AS ENUM (
    'direct_connect',
    'community',
    'trade_deal',
    'tool',
    'general'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE scout_outcome_action AS ENUM (
    'followed_advice',
    'ignored_advice',
    'completed_flow',
    'canceled',
    'dispute',
    'refund',
    'reported_spam',
    'regret_reported',
    'success_reported'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Scout outcome events
CREATE TABLE IF NOT EXISTS scout_outcome_events (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id varchar(255),
  context_type scout_outcome_context NOT NULL,
  context_id varchar(255),
  scope varchar(64) NOT NULL DEFAULT 'global',
  action scout_outcome_action NOT NULL,
  value numeric,
  confidence_delta_hint integer,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scout_outcome_user_id
  ON scout_outcome_events (user_id);
CREATE INDEX IF NOT EXISTS idx_scout_outcome_context
  ON scout_outcome_events (context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_scout_outcome_created_at
  ON scout_outcome_events (created_at);
CREATE INDEX IF NOT EXISTS idx_scout_outcome_scope
  ON scout_outcome_events (scope);

-- Per-user confidence state
CREATE TABLE IF NOT EXISTS scout_user_confidence_state (
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope varchar(64) NOT NULL DEFAULT 'global',
  baseline_confidence numeric NOT NULL DEFAULT 0.20,
  current_confidence numeric NOT NULL DEFAULT 0.20,
  last_updated_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_scout_confidence_updated_at
  ON scout_user_confidence_state (last_updated_at);

