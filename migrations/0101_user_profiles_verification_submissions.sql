ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS verification_submissions jsonb DEFAULT '{}'::jsonb;
