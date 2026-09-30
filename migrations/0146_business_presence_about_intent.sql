-- Private owner intents. Normal service changes insert events; parent erasure
-- can cascade rows. Hashes bind one proposal to one hosted profile snapshot.
ALTER TABLE business_presence_plans
  ADD COLUMN site_path_review_epoch integer NOT NULL DEFAULT 0
  CHECK (site_path_review_epoch >= 0);

-- Existing owner-reviewed site choices are already valid first selections.
-- They must not become permanently ineligible just because the epoch is new.
UPDATE business_presence_plans
SET site_path_review_epoch = 1
WHERE site_path IS NOT NULL
  AND site_path_selected_by IS NOT NULL
  AND reviewed_at IS NOT NULL;

CREATE TABLE business_presence_about_intent_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  event_sequence bigserial NOT NULL,
  event_kind varchar(16) NOT NULL CHECK (event_kind IN ('authorize', 'withdraw')),
  authorization_id varchar(64) REFERENCES business_presence_about_intent_events(id),
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  profile_id varchar NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id varchar NOT NULL REFERENCES business_presence_plans(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  evidence_digest varchar(64) NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
  plan_hash varchar(64) NOT NULL CHECK (plan_hash ~ '^[a-f0-9]{64}$'),
  fact_key varchar(16) NOT NULL CHECK (fact_key = 'about'),
  value_digest varchar(64) NOT NULL CHECK (value_digest ~ '^[a-f0-9]{64}$'),
  decision_id varchar NOT NULL REFERENCES business_presence_fact_decisions(id) ON DELETE CASCADE,
  decision_epoch integer NOT NULL CHECK (decision_epoch > 0),
  content_blocks_digest varchar(64) NOT NULL CHECK (content_blocks_digest ~ '^[a-f0-9]{64}$'),
  about_block_digest varchar(64) NOT NULL CHECK (about_block_digest ~ '^[a-f0-9]{64}$'),
  about_block_id varchar(64) NOT NULL CHECK (about_block_id ~ '^[a-f0-9]{64}$'),
  preview_digest varchar(64) NOT NULL CHECK (preview_digest ~ '^[a-f0-9]{64}$'),
  replacement_acknowledged boolean NOT NULL,
  idempotency_key varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presence_about_intent_event_shape CHECK (
    (event_kind = 'authorize' AND authorization_id IS NULL)
    OR (event_kind = 'withdraw' AND authorization_id IS NOT NULL)
  ),
  CONSTRAINT presence_about_intent_30_day_limit CHECK (
    event_kind = 'withdraw'
    OR (expires_at > created_at AND expires_at <= created_at + interval '30 days')
  ),
  CONSTRAINT presence_about_intent_request_uq UNIQUE (owner_user_id, business_id, idempotency_key)
);
CREATE UNIQUE INDEX presence_about_intent_sequence_uq
  ON business_presence_about_intent_events (event_sequence);
CREATE INDEX presence_about_intent_current_idx
  ON business_presence_about_intent_events (plan_id, revision, event_sequence);
CREATE INDEX presence_about_intent_withdraw_idx
  ON business_presence_about_intent_events (authorization_id, event_kind);
