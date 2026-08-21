-- Profile-native accounts may originate from a profile's canonical public route,
-- including dedicated surfaces such as /jw-stone. Keep paths internal while
-- removing the legacy /u-only restriction. Also keep protected entitlements in
-- sync with the private business verification decision.
-- tradescout-schema:0118:v1

ALTER TABLE profile_accounts
  DROP CONSTRAINT IF EXISTS profile_accounts_source_path_check;
ALTER TABLE profile_accounts
  ADD CONSTRAINT profile_accounts_source_path_check CHECK (
    source_path IS NULL
    OR (
      (source_path = '/' OR source_path ~ '^/[^/]')
      AND position(E'\\' in source_path) = 0
    )
  );

ALTER TABLE profile_accounts
  DROP CONSTRAINT IF EXISTS profile_accounts_resume_path_check;
ALTER TABLE profile_accounts
  ADD CONSTRAINT profile_accounts_resume_path_check CHECK (
    resume_path IS NULL
    OR (
      (resume_path = '/' OR resume_path ~ '^/[^/]')
      AND position(E'\\' in resume_path) = 0
    )
  );

COMMENT ON CONSTRAINT profile_accounts_source_path_check ON profile_accounts
  IS 'tradescout-schema:0118:v1';
COMMENT ON CONSTRAINT profile_accounts_resume_path_check ON profile_accounts
  IS 'tradescout-schema:0118:v1';

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

COMMENT ON TRIGGER profile_account_business_verification_sync ON user_profiles
  IS 'tradescout-schema:0118:v1';

-- Reconcile any existing business-account rows before the trigger existed.
UPDATE profile_accounts account
   SET verification_status = CASE
         WHEN business.verification_status::text = 'approved' THEN 'approved'
         WHEN business.verification_status::text = 'rejected' THEN 'rejected'
         ELSE 'pending'
       END,
       updated_at = NOW()
  FROM user_profiles business
 WHERE account.business_profile_id = business.id
   AND account.identity_kind = 'business';

UPDATE profile_account_entitlements entitlement
   SET status = CASE
         WHEN entitlement.status = 'suspended' THEN 'suspended'
         WHEN account.verification_status = 'approved' THEN 'active'
         WHEN account.verification_status = 'rejected' THEN 'revoked'
         ELSE 'pending_verification'
       END,
       updated_at = NOW()
  FROM profile_accounts account
 WHERE account.id = entitlement.profile_account_id;
