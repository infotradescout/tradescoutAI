-- Contact permissions hardening + audit trail + trust/decision linkage

ALTER TABLE contact_permissions
  ADD COLUMN IF NOT EXISTS authority_gate varchar(30),
  ADD COLUMN IF NOT EXISTS source_decision_card_id varchar,
  ADD COLUMN IF NOT EXISTS source_scout_recommendation_id varchar,
  ADD COLUMN IF NOT EXISTS intent varchar,
  ADD COLUMN IF NOT EXISTS decision_scope text,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(4,3),
  ADD COLUMN IF NOT EXISTS risk_flags text[],
  ADD COLUMN IF NOT EXISTS county_fips varchar(5),
  ADD COLUMN IF NOT EXISTS requester_trust_snapshot_id varchar,
  ADD COLUMN IF NOT EXISTS target_trust_snapshot_id varchar,
  ADD COLUMN IF NOT EXISTS responded_by varchar REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS response_reason text,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamp;

ALTER TABLE contact_permissions
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_contact_permissions_responded_at'
      AND conrelid = 'contact_permissions'::regclass
  ) THEN
    ALTER TABLE contact_permissions
      ADD CONSTRAINT chk_contact_permissions_responded_at
        CHECK (
          (status = 'pending' AND responded_at IS NULL)
          OR (status <> 'pending' AND responded_at IS NOT NULL)
        ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_contact_permissions_pending_fields'
      AND conrelid = 'contact_permissions'::regclass
  ) THEN
    ALTER TABLE contact_permissions
      ADD CONSTRAINT chk_contact_permissions_pending_fields
        CHECK (
          status <> 'pending'
          OR (last_request_type IS NOT NULL AND last_request_notification_id IS NOT NULL)
        ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contact_permissions_status
  ON contact_permissions (status);

CREATE INDEX IF NOT EXISTS idx_contact_permissions_county
  ON contact_permissions (county_fips);

-- Decision Cards (minimal table to validate authority)
CREATE TABLE IF NOT EXISTS decision_cards (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  status varchar NOT NULL DEFAULT 'active', -- active, completed, archived
  intent varchar NOT NULL,
  decision_scope text,
  title varchar,
  description text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  decided_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_decision_cards_user
  ON decision_cards (user_id);

-- Trust/CVS snapshots (precomputed)
CREATE TABLE IF NOT EXISTS trust_snapshots (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  county_fips varchar(5) NOT NULL,
  cvs_score numeric(5,2) NOT NULL,
  verification_status varchar,
  license_status varchar,
  insurance_status varchar,
  risk_flags text[],
  computed_at timestamp DEFAULT now(),
  version integer DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_trust_snapshots_user_county
  ON trust_snapshots (user_id, county_fips);

-- Contact permission event audit trail
CREATE TABLE IF NOT EXISTS contact_permission_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_permission_id varchar REFERENCES contact_permissions(id) ON DELETE cascade,
  requester_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  target_user_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  actor_id varchar REFERENCES users(id),
  event_type varchar NOT NULL, -- request_created, accepted, declined, blocked, auto_accepted, expired
  from_status contact_permission_status,
  to_status contact_permission_status,
  reason_code varchar,
  metadata jsonb,
  authority_gate varchar(30),
  source_decision_card_id varchar,
  source_scout_recommendation_id varchar,
  intent varchar,
  decision_scope text,
  confidence_score numeric(4,3),
  risk_flags text[],
  county_fips varchar(5),
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_permission_events_pair
  ON contact_permission_events (requester_id, target_user_id);

CREATE INDEX IF NOT EXISTS idx_contact_permission_events_contact
  ON contact_permission_events (contact_permission_id);
