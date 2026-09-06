-- Keep JW Stone pricing tied to an active membership rather than the separate
-- business-verification review lifecycle. From this cutover forward, automatic
-- account and verification writes never create a JW pricing revocation, so a
-- later suspension or revocation is an explicit override and stays authoritative.
-- tradescout-schema:0131:v1

-- Before 0131, every repository-supported JW pricing write derived `revoked`
-- from membership or business-verification state; there was no JW manual-revoke
-- operation. Normalize that pre-cutover meaning once. The function marker makes
-- a manual replay idempotent, so explicit post-cutover revocations are not reset.
DO $$
BEGIN
  IF obj_description(
       to_regprocedure('sync_profile_account_business_verification()'),
       'pg_proc'
     ) IS DISTINCT FROM 'tradescout-schema:0131:v1' THEN
    UPDATE profile_account_entitlements entitlement
       SET status = 'active',
           updated_at = NOW()
      FROM profile_accounts account
      INNER JOIN profiles target_profile
        ON target_profile.id = account.target_profile_id
     WHERE entitlement.profile_account_id = account.id
       AND entitlement.product_key = 'jw_stone_member_pricing'
       AND entitlement.status = 'revoked'
       AND target_profile.slug = 'jw-stone'
       AND account.target_business_id = target_profile.business_id
       AND account.identity_kind = 'business';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION sync_profile_account_business_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_verification_status TEXT;
BEGIN
  IF NEW.user_intent::text <> 'business' THEN
    RETURN NEW;
  END IF;

  next_verification_status := CASE
    WHEN NEW.verification_status::text = 'approved' THEN 'approved'
    WHEN NEW.verification_status::text = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END;

  UPDATE profile_accounts
     SET verification_status = next_verification_status,
         updated_at = NOW()
   WHERE business_profile_id = NEW.id
     AND identity_kind = 'business';

  UPDATE profile_account_entitlements entitlement
     SET status = CASE
           WHEN entitlement.product_key = 'jw_stone_member_pricing'
             THEN entitlement.status
           WHEN entitlement.status = 'suspended' THEN 'suspended'
           WHEN next_verification_status = 'approved' THEN 'active'
           WHEN next_verification_status = 'rejected' THEN 'revoked'
           ELSE 'pending_verification'
         END,
         updated_at = NOW()
    FROM profile_accounts account
   WHERE account.business_profile_id = NEW.id
     AND account.id = entitlement.profile_account_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_account_business_verification_sync
  ON user_profiles;

CREATE TRIGGER profile_account_business_verification_sync
AFTER INSERT OR UPDATE OF verification_status
ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION sync_profile_account_business_verification();

COMMENT ON FUNCTION sync_profile_account_business_verification()
  IS 'tradescout-schema:0131:v1';

COMMENT ON TRIGGER profile_account_business_verification_sync ON user_profiles
  IS 'tradescout-schema:0131:v1';
