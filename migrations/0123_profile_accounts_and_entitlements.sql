-- Profile-native account and entitlement state is migration-owned.
CREATE TABLE IF NOT EXISTS profile_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_profile_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  identity_kind TEXT NOT NULL,
  priority_key TEXT NOT NULL DEFAULT 'profile_account',
  status TEXT NOT NULL DEFAULT 'active',
  verification_status TEXT NOT NULL DEFAULT 'not_required',
  source_path TEXT,
  resume_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, target_profile_id),
  CHECK (identity_kind IN ('user', 'business')),
  CHECK (priority_key ~ '^[a-z0-9_]{2,80}$'),
  CHECK (status IN ('active', 'suspended', 'closed')),
  CHECK (verification_status IN ('not_required', 'pending', 'approved', 'rejected')),
  CHECK (
    (identity_kind = 'user' AND business_profile_id IS NULL AND verification_status = 'not_required')
    OR
    (identity_kind = 'business' AND business_profile_id IS NOT NULL AND verification_status <> 'not_required')
  ),
  CHECK (
    source_path IS NULL
    OR ((source_path = '/' OR source_path ~ '^/[^/]') AND source_path NOT LIKE '%\\%')
  ),
  CHECK (resume_path IS NULL OR (resume_path ~ '^/u/' AND resume_path NOT LIKE '%\\%'))
);

-- Releases before 0123 constrained source_path to /u/* even though the account
-- entry point is also rendered at /jw-stone and /bidrock. Discover and remove
-- that legacy check by its definition (its generated name was not stable), then
-- install one named constraint. Existing values are inspected before VALIDATE so
-- an unsafe row fails the migration instead of being silently rewritten.
DO $$
DECLARE
  legacy_constraint RECORD;
BEGIN
  FOR legacy_constraint IN
    SELECT constraint_record.conname
      FROM pg_constraint constraint_record
     WHERE constraint_record.conrelid = 'profile_accounts'::regclass
       AND constraint_record.contype = 'c'
       AND pg_get_constraintdef(constraint_record.oid) ILIKE '%source_path%'
       AND pg_get_constraintdef(constraint_record.oid) LIKE '%^/u/%'
  LOOP
    EXECUTE format(
      'ALTER TABLE profile_accounts DROP CONSTRAINT %I',
      legacy_constraint.conname
    );
  END LOOP;
END $$;

ALTER TABLE profile_accounts
  DROP CONSTRAINT IF EXISTS profile_accounts_source_path_safe_check;
ALTER TABLE profile_accounts
  ADD CONSTRAINT profile_accounts_source_path_safe_check
  CHECK (
    source_path IS NULL
    OR (
      source_path ~ '^/([^/].*)?$'
      AND source_path NOT LIKE '%\\%'
      AND source_path NOT LIKE '%/../%'
      AND source_path NOT LIKE '%/..'
      AND source_path NOT LIKE '../%'
      AND lower(source_path) NOT LIKE '%2e%2e%'
    )
  ) NOT VALID;

DO $$
DECLARE
  unsafe_source_path_count BIGINT;
BEGIN
  SELECT count(*)
    INTO unsafe_source_path_count
    FROM profile_accounts
   WHERE NOT (
     source_path IS NULL
     OR (
       source_path ~ '^/([^/].*)?$'
       AND source_path NOT LIKE '%\\%'
       AND source_path NOT LIKE '%/../%'
       AND source_path NOT LIKE '%/..'
       AND source_path NOT LIKE '../%'
       AND lower(source_path) NOT LIKE '%2e%2e%'
     )
   );
  IF unsafe_source_path_count > 0 THEN
    RAISE EXCEPTION
      'profile_accounts contains % unsafe source_path row(s); correct them before applying 0123',
      unsafe_source_path_count;
  END IF;
END $$;

ALTER TABLE profile_accounts
  VALIDATE CONSTRAINT profile_accounts_source_path_safe_check;

CREATE INDEX IF NOT EXISTS idx_profile_accounts_target
  ON profile_accounts(target_profile_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_accounts_owner
  ON profile_accounts(owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_accounts_business
  ON profile_accounts(business_profile_id, status, updated_at DESC)
  WHERE business_profile_id IS NOT NULL;

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
    RAISE EXCEPTION 'This profile account requires a private business identity';
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

CREATE TABLE IF NOT EXISTS profile_account_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_account_id UUID NOT NULL REFERENCES profile_accounts(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_account_id, product_key),
  CHECK (product_key ~ '^[a-z0-9_]{2,80}$'),
  CHECK (status IN ('pending_verification', 'active', 'suspended', 'revoked'))
);
CREATE INDEX IF NOT EXISTS idx_profile_account_entitlements_product_status
  ON profile_account_entitlements(product_key, status, updated_at DESC);
