-- Persistent, cross-instance password-reset and email-verification authority.
-- Raw links and verification codes are never stored; only keyed SHA-256 hashes.

CREATE TABLE IF NOT EXISTS auth_action_tokens (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose varchar(32) NOT NULL,
  token_hash varchar(64) NOT NULL,
  code_hash varchar(64),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_action_tokens_purpose_check
    CHECK (purpose IN ('password_reset', 'email_verification')),
  CONSTRAINT auth_action_tokens_token_hash_check
    CHECK (char_length(token_hash) = 64),
  CONSTRAINT auth_action_tokens_code_hash_check
    CHECK (code_hash IS NULL OR char_length(code_hash) = 64),
  CONSTRAINT auth_action_tokens_expiry_check
    CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_action_tokens_token_hash_unique
  ON auth_action_tokens(token_hash);

-- Expired rows are revoked by the next issuance while the owning user row is
-- locked. The partial uniqueness constraint is the final cross-instance guard
-- against two simultaneously active credentials for one purpose.
CREATE UNIQUE INDEX IF NOT EXISTS auth_action_tokens_one_active_per_user_purpose
  ON auth_action_tokens(user_id, purpose)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS auth_action_tokens_user_purpose_created_idx
  ON auth_action_tokens(user_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_action_tokens_expires_idx
  ON auth_action_tokens(expires_at);
