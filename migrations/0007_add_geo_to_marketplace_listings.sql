-- Add latitude/longitude to marketplace listings for hyper-local notifications
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6);
