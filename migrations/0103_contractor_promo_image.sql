-- Give contractor promotions their own shareable image. Existing promotions
-- remain valid and use the provider's first public project photo as a fallback.

ALTER TABLE contractor_promos
  ADD COLUMN IF NOT EXISTS image_url VARCHAR(2048);
