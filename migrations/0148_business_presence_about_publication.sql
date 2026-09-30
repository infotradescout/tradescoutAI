-- Fresh consent binds insertion/replacement to the shared profile revision and
-- exact profile identity. Existing intent rows deliberately remain inert.
ALTER TABLE business_presence_about_intent_events
  ADD COLUMN target_mode varchar(16),
  ADD COLUMN content_blocks_revision integer,
  ADD COLUMN profile_target_identity jsonb,
  ADD COLUMN publication_acknowledged boolean NOT NULL DEFAULT false,
  ADD COLUMN applied_content_blocks_revision integer,
  ADD COLUMN applied_content_blocks_digest varchar(64);

ALTER TABLE business_presence_about_intent_events
  DROP CONSTRAINT business_presence_about_intent_events_event_kind_check,
  DROP CONSTRAINT business_presence_about_intent_events_fact_key_check,
  DROP CONSTRAINT presence_about_intent_event_shape,
  DROP CONSTRAINT presence_about_intent_30_day_limit;

ALTER TABLE business_presence_about_intent_events
  ADD CONSTRAINT presence_about_intent_event_kind
    CHECK (event_kind IN ('authorize', 'withdraw', 'apply')),
  ADD CONSTRAINT presence_about_intent_fact_key
    CHECK (fact_key IN ('about', 'description')),
  ADD CONSTRAINT presence_about_intent_event_shape CHECK (
    (event_kind = 'authorize' AND authorization_id IS NULL)
    OR (event_kind IN ('withdraw', 'apply') AND authorization_id IS NOT NULL)
  ),
  ADD CONSTRAINT presence_about_intent_30_day_limit CHECK (
    event_kind <> 'authorize'
    OR (expires_at > created_at AND expires_at <= created_at + interval '30 days')
  ),
  ADD CONSTRAINT presence_about_intent_publication_binding CHECK (
    NOT publication_acknowledged
    OR (
      target_mode IS NOT NULL AND target_mode IN ('create', 'replace')
      AND content_blocks_revision IS NOT NULL AND content_blocks_revision > 0
      AND profile_target_identity IS NOT NULL AND jsonb_typeof(profile_target_identity) = 'object'
    )
  ),
  ADD CONSTRAINT presence_about_intent_applied_shape CHECK (
    (event_kind = 'apply'
      AND publication_acknowledged
      AND applied_content_blocks_revision IS NOT NULL
      AND applied_content_blocks_revision >= content_blocks_revision
      AND applied_content_blocks_digest IS NOT NULL
      AND applied_content_blocks_digest ~ '^[a-f0-9]{64}$')
    OR (event_kind <> 'apply'
      AND applied_content_blocks_revision IS NULL
      AND applied_content_blocks_digest IS NULL)
  );

-- One authorization may have one committed effect, regardless of retry key.
CREATE UNIQUE INDEX presence_about_intent_applied_uq
  ON business_presence_about_intent_events (authorization_id)
  WHERE event_kind = 'apply';
