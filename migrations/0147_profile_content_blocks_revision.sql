-- Version every persisted change to a profile's complete content-block array
-- or publication target. An identity edit and restore cannot revive old saves
-- or publication consent. Ordinary metadata updates keep their revision.
-- The database owns the increment so direct SQL and existing staff writers
-- invalidate stale owner saves and future About intent bindings as well.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS content_blocks_revision integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_content_blocks_revision_positive'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_content_blocks_revision_positive
      CHECK (content_blocks_revision > 0);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION assign_profile_content_blocks_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_blocks_revision := 1;
  ELSIF NEW.content_blocks IS DISTINCT FROM OLD.content_blocks
    OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.business_id IS DISTINCT FROM OLD.business_id
    OR NEW.role_context IS DISTINCT FROM OLD.role_context
    OR NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.publicly_released IS DISTINCT FROM OLD.publicly_released
    OR lower(btrim(coalesce(NEW.seo_meta ->> 'customDomain', '')))
      IS DISTINCT FROM lower(btrim(coalesce(OLD.seo_meta ->> 'customDomain', '')))
  THEN
    NEW.content_blocks_revision := OLD.content_blocks_revision + 1;
  ELSIF pg_trigger_depth() > 1
    AND NEW.content_blocks_revision = OLD.content_blocks_revision + 1
  THEN
    -- Only dependency triggers may advance the revision without changing
    -- this row's content or identity. Direct caller-supplied revisions cannot.
    NEW.content_blocks_revision := OLD.content_blocks_revision + 1;
  ELSE
    NEW.content_blocks_revision := OLD.content_blocks_revision;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_content_blocks_revision ON profiles;
CREATE TRIGGER profiles_content_blocks_revision
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION assign_profile_content_blocks_revision();
