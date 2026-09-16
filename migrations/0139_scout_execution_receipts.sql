-- A receipt is claimed BEFORE a Scout profile write. A pending or uncertain
-- receipt is never reclaimed automatically: its write may already have committed.
-- Additive schema; rollback the application without dropping these receipts.
CREATE TABLE scout_execution_receipts (
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  execution_id varchar(128) NOT NULL,
  action_type varchar(40) NOT NULL CHECK (action_type = 'SAVE_PROFILE'),
  request_fingerprint char(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'unconfirmed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  last_replayed_at timestamptz,
  replay_count integer NOT NULL DEFAULT 0 CHECK (replay_count >= 0),
  PRIMARY KEY (owner_user_id, execution_id),
  CONSTRAINT scout_execution_receipt_result_state CHECK (
    (status = 'completed' AND result IS NOT NULL AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND result IS NULL AND completed_at IS NULL)
  )
);
CREATE INDEX scout_execution_receipts_status_created_idx
  ON scout_execution_receipts (status, created_at);
COMMENT ON TABLE scout_execution_receipts IS
  'Private Scout execution receipts. Count completed rows, not requests or assistant messages. Never automatically expire or reclaim uncertain receipts.';
