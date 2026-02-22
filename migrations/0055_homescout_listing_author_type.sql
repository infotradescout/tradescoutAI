-- HomeScout listings: label whether a listing was posted by the property owner or an agent.
-- This is used for UI labeling and search ranking/filters without extra joins.

ALTER TABLE home_scout_listings
ADD COLUMN IF NOT EXISTS listing_author_type varchar(16) NOT NULL DEFAULT 'owner';

-- Best-effort backfill: if an agent_user_id is set, treat as agent-posted.
UPDATE home_scout_listings
SET listing_author_type = 'agent'
WHERE agent_user_id IS NOT NULL;

