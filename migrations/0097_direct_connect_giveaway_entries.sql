CREATE TABLE IF NOT EXISTS direct_connect_giveaway_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  work_request_id varchar NOT NULL REFERENCES work_requests(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  promotion_key varchar NOT NULL DEFAULT 'direct_connect_giveaway_2026_06',
  entry_method varchar NOT NULL DEFAULT 'direct_connect',
  residency_state_code varchar(2),
  is_eligible boolean NOT NULL DEFAULT false,
  eligibility_reason varchar NOT NULL,
  eligibility_snapshot jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT direct_connect_giveaway_entries_entry_method_check
    CHECK (entry_method IN ('direct_connect', 'alternate_email'))
);

CREATE UNIQUE INDEX IF NOT EXISTS dc_giveaway_entries_work_request_unique
  ON direct_connect_giveaway_entries(work_request_id);

CREATE INDEX IF NOT EXISTS dc_giveaway_entries_promotion_eligible_idx
  ON direct_connect_giveaway_entries(promotion_key, is_eligible);

CREATE INDEX IF NOT EXISTS dc_giveaway_entries_user_idx
  ON direct_connect_giveaway_entries(user_id);
