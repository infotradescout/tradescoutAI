ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS location_visibility varchar(50) DEFAULT 'exact';
