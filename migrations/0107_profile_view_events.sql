-- Real page-view events for public profiles. Recorded only on the client-side
-- profile data fetch (/api/u/:slug), which real browsers hit after hydrating --
-- the separate server-rendered crawler/SEO HTML path never touches this table,
-- so counts reflect human traffic rather than search-engine crawl volume.
-- Deliberately separate from CVS, trust snapshots, boosts, and exposure/ranking
-- inputs, same as public_profile_engagements.
CREATE TABLE IF NOT EXISTS profile_view_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id VARCHAR NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  referrer VARCHAR(512),
  user_agent VARCHAR(512),
  ip_hash VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profile_view_events_profile_created_idx
  ON profile_view_events(profile_id, created_at);
