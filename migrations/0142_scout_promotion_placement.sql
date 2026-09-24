-- Add Scout placement to canonical promotions without publishing existing campaigns.
-- Fresh databases need the table; existing promotions and explicit placements are preserved.
CREATE TABLE IF NOT EXISTS promotions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(200) NOT NULL,
  short_description varchar(280) NOT NULL,
  image_attachment_id varchar,
  cta_label varchar(80),
  cta_url text,
  type varchar NOT NULL,
  exclusive boolean NOT NULL DEFAULT false,
  tier varchar NOT NULL DEFAULT 'free_directory',
  status varchar NOT NULL DEFAULT 'draft',
  county_fips text[] NOT NULL DEFAULT ARRAY[]::text[],
  user_type_tags text[] DEFAULT ARRAY[]::text[],
  trade_slugs text[] DEFAULT ARRAY[]::text[],
  placement_community_snapshot boolean NOT NULL DEFAULT false,
  placement_community_feed boolean NOT NULL DEFAULT false,
  placement_scout boolean NOT NULL DEFAULT false,
  placement_marketplace boolean NOT NULL DEFAULT false,
  starts_at timestamp,
  ends_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS tier varchar NOT NULL DEFAULT 'free_directory',
  ADD COLUMN IF NOT EXISTS placement_scout boolean NOT NULL DEFAULT false;
UPDATE promotions SET tier = 'free_directory' WHERE tier IS NULL;
UPDATE promotions SET placement_scout = false WHERE placement_scout IS NULL;
ALTER TABLE promotions
  ALTER COLUMN tier SET DEFAULT 'free_directory',
  ALTER COLUMN tier SET NOT NULL,
  ALTER COLUMN placement_scout SET DEFAULT false,
  ALTER COLUMN placement_scout SET NOT NULL;
