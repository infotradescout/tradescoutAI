-- Fence durable email attempts with an explicit lease owner and scope setup
-- credentials to one delivery intent. Both changes are additive/idempotent so
-- this migration is safe for installations with historical outbox tables.

ALTER TABLE notification_delivery_log
  ADD COLUMN IF NOT EXISTS claim_token varchar;

ALTER TABLE auth_action_tokens
  ADD COLUMN IF NOT EXISTS scope_key varchar(255);

-- Default, user-requested credentials retain one-active-per-purpose behavior.
-- Durable delivery credentials use a non-null scope and therefore never revoke
-- or collide with unrelated links for the same user and purpose.
DROP INDEX IF EXISTS auth_action_tokens_one_active_per_user_purpose;
CREATE UNIQUE INDEX IF NOT EXISTS auth_action_tokens_one_active_per_user_purpose
  ON auth_action_tokens(user_id, purpose, COALESCE(scope_key, ''))
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
