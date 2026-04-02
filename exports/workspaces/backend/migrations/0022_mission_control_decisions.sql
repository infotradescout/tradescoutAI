-- Mission Control v0 - Decision tracking for daily operating loop
-- Prevents repeat recommendations and creates accountability

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_control_decision_action') THEN
    CREATE TYPE mission_control_decision_action AS ENUM (
      'done',
      'defer'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS mission_control_decisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_date date NOT NULL,
  recommended_fix_source_type mission_control_source NOT NULL,
  recommended_fix_source_id varchar(128) NOT NULL,
  action mission_control_decision_action NOT NULL,
  defer_reason text,
  actor_user_id varchar REFERENCES users(id),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT mission_control_decision_unique UNIQUE (decision_date, recommended_fix_source_type, recommended_fix_source_id)
);

CREATE INDEX IF NOT EXISTS mission_control_decisions_date_idx ON mission_control_decisions(decision_date);
CREATE INDEX IF NOT EXISTS mission_control_decisions_action_idx ON mission_control_decisions(action);
