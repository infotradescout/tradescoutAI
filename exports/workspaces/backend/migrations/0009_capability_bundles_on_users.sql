ALTER TABLE users
  ADD COLUMN IF NOT EXISTS capability_bundles text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS participation_modes text[] DEFAULT ARRAY[]::text[];
