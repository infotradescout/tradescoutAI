ALTER TABLE profile_booking_requests
  ADD COLUMN IF NOT EXISTS profile_id varchar;

ALTER TABLE profile_booking_requests
  ADD COLUMN IF NOT EXISTS lineage_kind varchar NOT NULL DEFAULT 'legacy_owner';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS publicly_released boolean NOT NULL DEFAULT false;

-- Preserve the exact release decisions that predate the canonical column. The
-- account-wide legacy flag maps only to the owner's active Profile so it cannot
-- widen every sibling Profile during migration.
UPDATE profiles AS profile
   SET publicly_released = true
  FROM users AS owner
 WHERE profile.owner_user_id = owner.id
   AND profile.status = 'published'
   AND (
     COALESCE(owner.preferences -> 'publicProfileIds', '[]'::jsonb)
       @> jsonb_build_array(profile.id::text)
     OR (
       lower(COALESCE(owner.preferences ->> 'profileVisibility', 'private')) = 'public'
       AND owner.active_profile_id = profile.id
     )
   );

ALTER TABLE profile_booking_requests
  DROP CONSTRAINT IF EXISTS profile_booking_requests_profile_id_fk;

ALTER TABLE profile_booking_requests
  ADD CONSTRAINT profile_booking_requests_profile_id_fk
  FOREIGN KEY (profile_id)
  REFERENCES profiles(id)
  ON DELETE RESTRICT;

ALTER TABLE profile_booking_requests
  DROP CONSTRAINT IF EXISTS profile_booking_requests_lineage_consistency_check;

ALTER TABLE profile_booking_requests
  ADD CONSTRAINT profile_booking_requests_lineage_consistency_check
  CHECK (
    (lineage_kind = 'exact_profile' AND profile_id IS NOT NULL)
    OR
    (lineage_kind IN ('legacy_owner', 'legacy_business_profile') AND profile_id IS NULL)
  );

CREATE OR REPLACE FUNCTION enforce_profile_booking_request_lineage_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lineage_kind = 'exact_profile' THEN
    PERFORM 1
      FROM profiles
     WHERE id = NEW.profile_id
       AND owner_user_id = NEW.owner_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Exact booking Profile must belong to the booking owner'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR NEW.lineage_kind IS DISTINCT FROM OLD.lineage_kind
       OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id THEN
      RAISE EXCEPTION 'Profile booking request lineage is immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_booking_requests_lineage_immutability_trigger
  ON profile_booking_requests;
CREATE TRIGGER profile_booking_requests_lineage_immutability_trigger
BEFORE INSERT OR UPDATE OF profile_id, lineage_kind, owner_user_id, requester_user_id
ON profile_booking_requests
FOR EACH ROW
EXECUTE FUNCTION enforce_profile_booking_request_lineage_immutability();

COMMENT ON COLUMN profile_booking_requests.profile_id IS
  'Exact Profile that authorized this booking; null only when lineage_kind explicitly records a legacy path; tradescout-schema:0128:v4';
COMMENT ON COLUMN profile_booking_requests.lineage_kind IS
  'Immutable booking authority lineage; exact rows retain their Profile by RESTRICT; tradescout-schema:0128:v4';
COMMENT ON COLUMN profiles.publicly_released IS
  'Sole per-Profile anonymous release authority; preference ids are compatibility/UI only; tradescout-schema:0128:v4';
COMMENT ON CONSTRAINT profile_booking_requests_profile_id_fk ON profile_booking_requests IS
  'tradescout-schema:0128:v4';
COMMENT ON CONSTRAINT profile_booking_requests_lineage_consistency_check ON profile_booking_requests IS
  'tradescout-schema:0128:v4';
COMMENT ON FUNCTION enforce_profile_booking_request_lineage_immutability() IS
  'tradescout-schema:0128:v4';
COMMENT ON TRIGGER profile_booking_requests_lineage_immutability_trigger ON profile_booking_requests IS
  'tradescout-schema:0128:v4';

DROP INDEX IF EXISTS idx_profile_booking_requests_profile;
CREATE INDEX idx_profile_booking_requests_profile
  ON profile_booking_requests(profile_id)
  WHERE profile_id IS NOT NULL;

COMMENT ON INDEX idx_profile_booking_requests_profile IS
  'tradescout-schema:0128:v4';
