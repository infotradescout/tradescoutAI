-- Mission Control v0 data wiring: bot UI findings, Scout interactions, and daily fix decisions

-- Bot UI failure types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bot_ui_failure_type') THEN
    CREATE TYPE bot_ui_failure_type AS ENUM (
      'broken',
      'stub',
      'confusing',
      'misleading',
      'permission_block'
    );
  END IF;
END$$;

-- Scout interaction enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scout_interaction_intent') THEN
    CREATE TYPE scout_interaction_intent AS ENUM (
      'hire',
      'advise',
      'collaborate',
      'unknown'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scout_interaction_outcome') THEN
    CREATE TYPE scout_interaction_outcome AS ENUM (
      'completed',
      'handed_off',
      'blocked',
      'abandoned'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scout_interaction_failure_reason') THEN
    CREATE TYPE scout_interaction_failure_reason AS ENUM (
      'missing_data',
      'no_route',
      'ui_dead_end',
      'permission',
      'unclear_copy'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scout_interaction_user_role') THEN
    CREATE TYPE scout_interaction_user_role AS ENUM (
      'homeowner',
      'contractor',
      'admin'
    );
  END IF;
END$$;

-- Mission Control enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_control_source') THEN
    CREATE TYPE mission_control_source AS ENUM (
      'bot_ui',
      'scout',
      'error_report'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_control_action_status') THEN
    CREATE TYPE mission_control_action_status AS ENUM (
      'open',
      'done',
      'deferred'
    );
  END IF;
END$$;

-- Bot UI findings table
CREATE TABLE IF NOT EXISTS bot_ui_findings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_name varchar(120) NOT NULL,
  route varchar(512) NOT NULL,
  action_attempted text,
  expected_outcome text,
  actual_outcome text,
  failure_type bot_ui_failure_type NOT NULL,
  severity integer NOT NULL DEFAULT 1,
  screenshot_url text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_ui_findings_route_idx ON bot_ui_findings(route);
CREATE INDEX IF NOT EXISTS bot_ui_findings_created_idx ON bot_ui_findings(created_at);

-- Scout interactions table (bots excluded upstream)
CREATE TABLE IF NOT EXISTS scout_interactions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role scout_interaction_user_role NOT NULL,
  county_fips varchar(5),
  intent scout_interaction_intent NOT NULL DEFAULT 'unknown',
  scout_confidence integer NOT NULL DEFAULT 0,
  outcome scout_interaction_outcome NOT NULL,
  failure_reason scout_interaction_failure_reason,
  scout_message_hash varchar(64),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scout_interactions_created_idx ON scout_interactions(created_at);
CREATE INDEX IF NOT EXISTS scout_interactions_intent_idx ON scout_interactions(intent);
CREATE INDEX IF NOT EXISTS scout_interactions_role_idx ON scout_interactions(user_role);

-- Mission Control action log (one-fix decisions)
CREATE TABLE IF NOT EXISTS mission_control_actions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type mission_control_source NOT NULL,
  source_id varchar(128) NOT NULL,
  status mission_control_action_status NOT NULL DEFAULT 'open',
  summary text,
  suggested_fix text,
  decision_reason text,
  decided_by_user_id varchar REFERENCES users(id),
  impact_score integer,
  suggested_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT mission_control_action_source_unique UNIQUE (source_type, source_id)
);

CREATE INDEX IF NOT EXISTS mission_control_action_status_idx ON mission_control_actions(status);
