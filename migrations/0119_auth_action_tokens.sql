CREATE TABLE IF NOT EXISTS auth_action_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_action_tokens_purpose_check
    CHECK (purpose IN ('email_verification', 'password_reset', 'password_reset_code')),
  CONSTRAINT auth_action_tokens_purpose_hash_unique UNIQUE (purpose, token_hash)
);

CREATE INDEX IF NOT EXISTS auth_action_tokens_user_purpose_idx
  ON auth_action_tokens (user_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_action_tokens_expires_at_idx
  ON auth_action_tokens (expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS auth_action_tokens_password_reset_code_user_uidx
  ON auth_action_tokens (user_id)
  WHERE purpose = 'password_reset_code';

COMMENT ON TABLE auth_action_tokens IS 'tradescout-schema:0119:v1';
