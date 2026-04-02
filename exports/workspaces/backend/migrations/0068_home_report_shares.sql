-- Home Report Shares (Messaging)
-- Purpose: allow a user to share a private "home report" into an intent-gated conversation
-- so the other party can see useful context (without leaking address unless explicitly allowed).
--
-- Platform law:
-- - No pay-to-play, no lead selling.
-- - Sharing does not grant contact authority; it only adds context inside an already-gated thread.

CREATE TABLE IF NOT EXISTS home_report_shares (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  thread_id VARCHAR NOT NULL,
  thread_type VARCHAR NOT NULL DEFAULT 'marketplace', -- marketplace | legacy

  user_home_id VARCHAR NOT NULL REFERENCES user_homes(id) ON DELETE CASCADE,

  include_address BOOLEAN NOT NULL DEFAULT FALSE,
  include_documents BOOLEAN NOT NULL DEFAULT FALSE,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_home_report_shares_thread ON home_report_shares(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_home_report_shares_home ON home_report_shares(user_home_id, created_at);
CREATE INDEX IF NOT EXISTS idx_home_report_shares_owner ON home_report_shares(owner_user_id, updated_at);

