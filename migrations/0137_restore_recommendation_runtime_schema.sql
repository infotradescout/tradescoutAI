-- Restore the existing recommendation contract after the rating-only 0000 table.
-- Numeric ratings are retained as history and never mapped to endorsements.
-- Only explicit, verified, public, approved positive/negative recommendations
-- qualify for current Trust/CVS scoring. Missing historical evidence stays private.
ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS recommendation_type varchar,
  ADD COLUMN IF NOT EXISTS project_type varchar,
  ADD COLUMN IF NOT EXISTS project_value numeric,
  ADD COLUMN IF NOT EXISTS work_quality varchar,
  ADD COLUMN IF NOT EXISTS timeliness varchar,
  ADD COLUMN IF NOT EXISTS communication varchar,
  ADD COLUMN IF NOT EXISTS would_hire_again boolean,
  ADD COLUMN IF NOT EXISTS customer_name varchar,
  ADD COLUMN IF NOT EXISTS customer_email varchar,
  ADD COLUMN IF NOT EXISTS customer_phone varchar,
  ADD COLUMN IF NOT EXISTS ip_address varchar,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS verification_method varchar,
  ADD COLUMN IF NOT EXISTS verified_at timestamp,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status varchar DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderated_at timestamp,
  ADD COLUMN IF NOT EXISTS moderated_by varchar;

-- Empty required strings represent absent history, not invented customer facts.
-- Existing non-null customer and comment values remain unchanged. Established
-- classified rows retain their classification, visibility and moderation evidence.
UPDATE recommendations SET recommendation_type = 'legacy_unclassified',
  is_public = false, moderation_status = 'pending'
  WHERE recommendation_type IS NULL;
UPDATE recommendations SET comment = '' WHERE comment IS NULL;
UPDATE recommendations SET customer_name = '' WHERE customer_name IS NULL;
UPDATE recommendations SET customer_email = '' WHERE customer_email IS NULL;
ALTER TABLE recommendations
  ALTER COLUMN recommendation_type SET NOT NULL,
  ALTER COLUMN recommendation_type DROP DEFAULT,
  ALTER COLUMN comment SET NOT NULL,
  ALTER COLUMN comment DROP DEFAULT,
  ALTER COLUMN customer_name SET NOT NULL,
  ALTER COLUMN customer_name DROP DEFAULT,
  ALTER COLUMN customer_email SET NOT NULL,
  ALTER COLUMN customer_email DROP DEFAULT,
  ALTER COLUMN is_public SET DEFAULT false,
  ALTER COLUMN moderation_status SET DEFAULT 'pending';

-- Current writers provide an explicit recommendation type, not a numeric rating.
-- Retain legacy ratings without requiring new writes to invent one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='recommendations'
               AND column_name='rating') THEN
    ALTER TABLE recommendations ALTER COLUMN rating DROP NOT NULL;
  END IF;
END;
$$;
