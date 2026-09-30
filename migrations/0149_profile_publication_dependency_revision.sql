-- A public eligibility or fallback About visibility edit and restore must not
-- revive a prior publication authorization or stale complete-page save.
-- Advance the same database-owned profile revision only for dependencies used
-- by the generic business About publication path; unrelated metadata is inert.
CREATE OR REPLACE FUNCTION version_business_profile_publication_dependencies()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR lower(btrim(coalesce(NEW.status::text, '')))
      IS DISTINCT FROM lower(btrim(coalesce(OLD.status::text, '')))
    OR NEW.public_discovery_enabled IS DISTINCT FROM OLD.public_discovery_enabled
    OR coalesce(NEW.profile_data -> 'tradePartner' = 'true'::jsonb, false)
      IS DISTINCT FROM coalesce(OLD.profile_data -> 'tradePartner' = 'true'::jsonb, false)
  THEN
    UPDATE profiles
      SET content_blocks_revision = content_blocks_revision + 1
      WHERE business_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION version_owner_profile_publication_dependencies()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  verification_changed boolean;
  fallback_about_changed boolean;
BEGIN
  verification_changed := (
    lower(btrim(coalesce(NEW.verification_status::text, ''))) <> 'suspended'
    AND (coalesce(NEW.verified_badge, false) = true OR lower(btrim(coalesce(NEW.verification_status::text, ''))) = 'approved')
  ) IS DISTINCT FROM (
    lower(btrim(coalesce(OLD.verification_status::text, ''))) <> 'suspended'
    AND (coalesce(OLD.verified_badge, false) = true OR lower(btrim(coalesce(OLD.verification_status::text, ''))) = 'approved')
  );
  fallback_about_changed :=
    coalesce(NEW.preferences -> 'profileSections' -> 'about' = 'false'::jsonb, false)
    IS DISTINCT FROM coalesce(OLD.preferences -> 'profileSections' -> 'about' = 'false'::jsonb, false);

  IF verification_changed OR fallback_about_changed THEN
    UPDATE profiles AS profile
      SET content_blocks_revision = content_blocks_revision + 1
      WHERE owner_user_id = NEW.id
        AND (
          verification_changed
          OR NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(CASE
              WHEN jsonb_typeof(profile.content_blocks) = 'array' THEN profile.content_blocks
              ELSE '[]'::jsonb
            END) AS block
            WHERE block ->> 'type' = 'profileSections'
          )
        );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_profile_publication_dependencies ON businesses;
CREATE TRIGGER business_profile_publication_dependencies
AFTER UPDATE OF owner_user_id, status, public_discovery_enabled, profile_data ON businesses
FOR EACH ROW
EXECUTE FUNCTION version_business_profile_publication_dependencies();

DROP TRIGGER IF EXISTS owner_profile_publication_dependencies ON users;
CREATE TRIGGER owner_profile_publication_dependencies
AFTER UPDATE OF verified_badge, verification_status, preferences ON users
FOR EACH ROW
EXECUTE FUNCTION version_owner_profile_publication_dependencies();
