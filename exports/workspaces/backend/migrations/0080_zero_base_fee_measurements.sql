CREATE TABLE IF NOT EXISTS zero_base_fee_sessions (
  checkout_session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'created',
  paid_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zero_base_fee_sessions_user_created
  ON zero_base_fee_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS zero_base_fee_reports (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  checkout_session_id TEXT NOT NULL,
  reference_mode TEXT NOT NULL,
  pixels_per_inch NUMERIC(12,4),
  measured_inches NUMERIC(12,4),
  measured_pixels NUMERIC(12,4),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zero_base_fee_reports_user_created
  ON zero_base_fee_reports(user_id, created_at DESC);
