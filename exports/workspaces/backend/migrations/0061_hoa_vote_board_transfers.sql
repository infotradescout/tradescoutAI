-- Structured metadata for HOA board role transfer votes
-- Keeps HOA governance vote rules in control while enabling deterministic authority transfer.

CREATE TABLE IF NOT EXISTS hoa_vote_board_transfers (
  vote_id varchar PRIMARY KEY REFERENCES hoa_votes(id) ON DELETE CASCADE,
  hoa_id varchar NOT NULL REFERENCES homeowner_associations(id) ON DELETE CASCADE,
  target_role varchar NOT NULL,
  nominee_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiated_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initiation_reason text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hoa_vote_board_transfers_hoa ON hoa_vote_board_transfers(hoa_id);
CREATE INDEX IF NOT EXISTS idx_hoa_vote_board_transfers_role ON hoa_vote_board_transfers(target_role);
CREATE INDEX IF NOT EXISTS idx_hoa_vote_board_transfers_nominee ON hoa_vote_board_transfers(nominee_user_id);
CREATE INDEX IF NOT EXISTS idx_hoa_vote_board_transfers_initiator ON hoa_vote_board_transfers(initiated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_hoa_vote_board_transfers_created_at ON hoa_vote_board_transfers(created_at DESC);
