-- 0123 replaced the 0115 identity function and dropped the trigger's contract
-- marker. Restore the canonical ownership checks and verifier-visible trigger
-- in a forward migration; previously recorded SQL and hashes stay unchanged.
CREATE OR REPLACE FUNCTION enforce_profile_account_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  profile_owner_user_id TEXT;
  profile_intent TEXT;
BEGIN
  IF NEW.identity_kind = 'user' THEN
    IF NEW.business_profile_id IS NOT NULL OR NEW.verification_status <> 'not_required' THEN
      RAISE EXCEPTION 'User profile accounts cannot carry a business identity';
    END IF;
    RETURN NEW;
  END IF;

  SELECT user_id, user_intent::text
    INTO profile_owner_user_id, profile_intent
    FROM user_profiles
   WHERE id = NEW.business_profile_id;

  IF NOT FOUND OR profile_intent <> 'business' THEN
    RAISE EXCEPTION 'This profile account requires a TradeScout business profile';
  END IF;

  IF profile_owner_user_id <> NEW.owner_user_id THEN
    RAISE EXCEPTION 'Profile account business ownership does not match the signed-in user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_accounts_identity_trigger ON profile_accounts;
CREATE TRIGGER profile_accounts_identity_trigger
BEFORE INSERT OR UPDATE OF identity_kind, business_profile_id, owner_user_id, verification_status
ON profile_accounts
FOR EACH ROW EXECUTE FUNCTION enforce_profile_account_identity();

COMMENT ON TRIGGER profile_accounts_identity_trigger ON profile_accounts
  IS 'tradescout-schema:0115:v1';
