CREATE TABLE IF NOT EXISTS trust_ledger_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar(120) NOT NULL,
  event_type varchar(120) NOT NULL,
  source_surface varchar(80) NOT NULL,
  verification_level varchar(40) NOT NULL DEFAULT 'none',
  confidence numeric(4, 3) NOT NULL DEFAULT 0.500,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_ledger_entity
  ON trust_ledger_events (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_trust_ledger_event
  ON trust_ledger_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_trust_ledger_actor
  ON trust_ledger_events (actor_user_id, created_at);
