-- LA Plumbing's public request label and search description are product-level
-- invariants. Enforce them at the final persistence boundary so idempotent
-- profile provisioning, staff edits, and future data repairs cannot restore
-- obsolete customer-facing copy.

CREATE OR REPLACE FUNCTION enforce_la_plumbing_public_copy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug = 'la-plumbing-solutions' THEN
    NEW.cta_config := jsonb_set(
      COALESCE(NEW.cta_config, '{}'::jsonb),
      '{primary,label}',
      to_jsonb('Start a Request'::text),
      true
    );

    NEW.seo_meta := jsonb_set(
      COALESCE(NEW.seo_meta, '{}'::jsonb),
      '{description}',
      to_jsonb(
        'Residential and commercial plumbing repairs, drains, water heaters, gas, backflow, renovations, and new construction from Hammond, Louisiana.'::text
      ),
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_la_plumbing_public_copy ON profiles;

CREATE TRIGGER profiles_la_plumbing_public_copy
BEFORE INSERT OR UPDATE OF slug, cta_config, seo_meta ON profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_la_plumbing_public_copy();

UPDATE profiles
SET
  cta_config = jsonb_set(
    COALESCE(cta_config, '{}'::jsonb),
    '{primary,label}',
    to_jsonb('Start a Request'::text),
    true
  ),
  seo_meta = jsonb_set(
    COALESCE(seo_meta, '{}'::jsonb),
    '{description}',
    to_jsonb(
      'Residential and commercial plumbing repairs, drains, water heaters, gas, backflow, renovations, and new construction from Hammond, Louisiana.'::text
    ),
    true
  ),
  updated_at = NOW()
WHERE slug = 'la-plumbing-solutions';
