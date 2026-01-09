-- Add user identity/profile URL columns expected by shared/schema.ts
-- Additive only: nullable columns, no defaults, no backfill

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_slug varchar,
  ADD COLUMN IF NOT EXISTS facebook_id varchar,
  ADD COLUMN IF NOT EXISTS google_id varchar;

-- Match shared/schema.ts: businessSlug is unique.
-- Unique index allows multiple NULLs, so no behavioral change for existing rows.
CREATE UNIQUE INDEX IF NOT EXISTS users_business_slug_unique ON users (business_slug);
