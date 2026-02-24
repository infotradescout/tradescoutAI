-- Persist HOA membership departures (self-service leave) with required reason
-- Supports governance traceability without implying HOA "ban" authority.

CREATE TABLE IF NOT EXISTS hoa_membership_departures (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hoa_id varchar NOT NULL REFERENCES homeowner_associations(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_role varchar,
  reason text NOT NULL,
  left_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hoa_membership_departures_hoa ON hoa_membership_departures(hoa_id);
CREATE INDEX IF NOT EXISTS idx_hoa_membership_departures_user ON hoa_membership_departures(user_id);
CREATE INDEX IF NOT EXISTS idx_hoa_membership_departures_actor ON hoa_membership_departures(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_hoa_membership_departures_left_at ON hoa_membership_departures(left_at DESC);
