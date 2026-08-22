-- Align fresh migrated databases with the canonical users table used by the runtime.
-- Existing production columns and values are preserved by the additive guards.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS county varchar,
  ADD COLUMN IF NOT EXISTS verification_status verification_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS theme_preference varchar DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS custom_theme_colors text;

COMMENT ON COLUMN public.users.county IS
  'Legacy display county retained for runtime compatibility; county_fips remains canonical.';

