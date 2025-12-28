-- Add profile_version column to users for profile normalization and gating
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_version integer NOT NULL DEFAULT 0;
