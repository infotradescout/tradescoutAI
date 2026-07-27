CREATE TABLE IF NOT EXISTS plugin_oauth_approvals (
  token_hash text PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  scopes text[] NOT NULL,
  code_challenge text NOT NULL,
  state text NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_oauth_codes (
  code_hash text PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  scopes text[] NOT NULL,
  code_challenge text NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_change_receipts (
  id bigserial PRIMARY KEY,
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  proposal_id text NOT NULL,
  receipt jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS plugin_oauth_approvals_expiry_idx
  ON plugin_oauth_approvals(expires_at);
CREATE INDEX IF NOT EXISTS plugin_oauth_codes_expiry_idx
  ON plugin_oauth_codes(expires_at);
