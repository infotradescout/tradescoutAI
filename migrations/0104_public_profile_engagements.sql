-- Restore TradeScout's own Like and Favorite controls on canonical public
-- profiles. These rows are engagement/save state only. They are deliberately
-- separate from CVS, trust snapshots, boosts, and exposure/ranking inputs.

CREATE TABLE IF NOT EXISTS public_profile_engagements (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id VARCHAR NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(24) NOT NULL CHECK (action IN ('like', 'favorite')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS public_profile_engagements_profile_user_action_uidx
  ON public_profile_engagements(profile_id, user_id, action);

CREATE INDEX IF NOT EXISTS public_profile_engagements_profile_action_idx
  ON public_profile_engagements(profile_id, action);

CREATE INDEX IF NOT EXISTS public_profile_engagements_user_idx
  ON public_profile_engagements(user_id);
