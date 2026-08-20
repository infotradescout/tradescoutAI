-- Profile accounts are durable application schema. They must be installed by
-- the migration chain, never created as a side effect of an HTTP request.

CREATE TABLE IF NOT EXISTS profile_accounts (
  id UUID CONSTRAINT profile_accounts_pkey PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL
    CONSTRAINT profile_accounts_owner_user_fk REFERENCES users(id) ON DELETE CASCADE,
  business_profile_id TEXT
    CONSTRAINT profile_accounts_business_profile_fk REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_profile_id TEXT NOT NULL
    CONSTRAINT profile_accounts_target_profile_fk REFERENCES profiles(id) ON DELETE CASCADE,
  target_business_id TEXT
    CONSTRAINT profile_accounts_target_business_fk REFERENCES businesses(id) ON DELETE SET NULL,
  identity_kind TEXT NOT NULL,
  priority_key TEXT NOT NULL DEFAULT 'profile_account',
  status TEXT NOT NULL DEFAULT 'active',
  verification_status TEXT NOT NULL DEFAULT 'not_required',
  source_path TEXT,
  resume_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profile_accounts_owner_target_unique UNIQUE (owner_user_id, target_profile_id),
  CONSTRAINT profile_accounts_identity_kind_check
    CHECK (identity_kind IN ('user', 'business')),
  CONSTRAINT profile_accounts_priority_key_check
    CHECK (priority_key ~ '^[a-z0-9_]{2,80}$'),
  CONSTRAINT profile_accounts_status_check
    CHECK (status IN ('active', 'suspended', 'closed')),
  CONSTRAINT profile_accounts_verification_status_check
    CHECK (verification_status IN ('not_required', 'pending', 'approved', 'rejected')),
  CONSTRAINT profile_accounts_identity_consistency_check CHECK (
    (identity_kind = 'user' AND business_profile_id IS NULL AND verification_status = 'not_required')
    OR
    (identity_kind = 'business' AND business_profile_id IS NOT NULL AND verification_status <> 'not_required')
  ),
  CONSTRAINT profile_accounts_source_path_check
    CHECK (source_path IS NULL OR (source_path ~ '^/u/' AND source_path NOT LIKE '%\\%')),
  CONSTRAINT profile_accounts_resume_path_check
    CHECK (resume_path IS NULL OR (resume_path ~ '^/u/' AND resume_path NOT LIKE '%\\%'))
);

-- A request may have created the legacy table before this migration existed.
-- Rebuild named constraints so both legacy and fresh installs receive an exact,
-- migration-owned contract. Legacy auto-named equivalents may remain harmlessly.
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_owner_user_fk;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_owner_user_fk
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_business_profile_fk;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_business_profile_fk
  FOREIGN KEY (business_profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_target_profile_fk;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_target_profile_fk
  FOREIGN KEY (target_profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_target_business_fk;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_target_business_fk
  FOREIGN KEY (target_business_id) REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_owner_target_unique;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_owner_target_unique
  UNIQUE (owner_user_id, target_profile_id);
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_identity_kind_check;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_identity_kind_check
  CHECK (identity_kind IN ('user', 'business'));
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_priority_key_check;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_priority_key_check
  CHECK (priority_key ~ '^[a-z0-9_]{2,80}$');
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_status_check;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_status_check
  CHECK (status IN ('active', 'suspended', 'closed'));
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_verification_status_check;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_verification_status_check
  CHECK (verification_status IN ('not_required', 'pending', 'approved', 'rejected'));
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_identity_consistency_check;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_identity_consistency_check CHECK (
  (identity_kind = 'user' AND business_profile_id IS NULL AND verification_status = 'not_required')
  OR
  (identity_kind = 'business' AND business_profile_id IS NOT NULL AND verification_status <> 'not_required')
);
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_source_path_check;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_source_path_check
  CHECK (source_path IS NULL OR (source_path ~ '^/u/' AND source_path NOT LIKE '%\\%'));
ALTER TABLE profile_accounts DROP CONSTRAINT IF EXISTS profile_accounts_resume_path_check;
ALTER TABLE profile_accounts ADD CONSTRAINT profile_accounts_resume_path_check
  CHECK (resume_path IS NULL OR (resume_path ~ '^/u/' AND resume_path NOT LIKE '%\\%'));

COMMENT ON CONSTRAINT profile_accounts_owner_user_fk ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_business_profile_fk ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_target_profile_fk ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_target_business_fk ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_owner_target_unique ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_identity_kind_check ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_priority_key_check ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_status_check ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_verification_status_check ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_identity_consistency_check ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_source_path_check ON profile_accounts IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_accounts_resume_path_check ON profile_accounts IS 'tradescout-schema:0115:v1';

DROP INDEX IF EXISTS idx_profile_accounts_target;
CREATE INDEX idx_profile_accounts_target
  ON profile_accounts(target_profile_id, status, updated_at DESC);
COMMENT ON INDEX idx_profile_accounts_target IS 'tradescout-schema:0115:v1';

DROP INDEX IF EXISTS idx_profile_accounts_owner;
CREATE INDEX idx_profile_accounts_owner
  ON profile_accounts(owner_user_id, status, updated_at DESC);
COMMENT ON INDEX idx_profile_accounts_owner IS 'tradescout-schema:0115:v1';

DROP INDEX IF EXISTS idx_profile_accounts_business;
CREATE INDEX idx_profile_accounts_business
  ON profile_accounts(business_profile_id, status, updated_at DESC)
  WHERE business_profile_id IS NOT NULL;
COMMENT ON INDEX idx_profile_accounts_business IS 'tradescout-schema:0115:v1';

CREATE TABLE IF NOT EXISTS profile_account_entitlements (
  id UUID CONSTRAINT profile_account_entitlements_pkey PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_account_id UUID NOT NULL
    CONSTRAINT profile_account_entitlements_account_fk
    REFERENCES profile_accounts(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profile_account_entitlements_account_product_unique
    UNIQUE (profile_account_id, product_key),
  CONSTRAINT profile_account_entitlements_product_key_check
    CHECK (product_key ~ '^[a-z0-9_]{2,80}$'),
  CONSTRAINT profile_account_entitlements_status_check
    CHECK (status IN ('pending_verification', 'active', 'suspended', 'revoked'))
);

ALTER TABLE profile_account_entitlements
  DROP CONSTRAINT IF EXISTS profile_account_entitlements_account_fk;
ALTER TABLE profile_account_entitlements
  ADD CONSTRAINT profile_account_entitlements_account_fk
  FOREIGN KEY (profile_account_id) REFERENCES profile_accounts(id) ON DELETE CASCADE;
ALTER TABLE profile_account_entitlements
  DROP CONSTRAINT IF EXISTS profile_account_entitlements_account_product_unique;
ALTER TABLE profile_account_entitlements
  ADD CONSTRAINT profile_account_entitlements_account_product_unique
  UNIQUE (profile_account_id, product_key);
ALTER TABLE profile_account_entitlements
  DROP CONSTRAINT IF EXISTS profile_account_entitlements_product_key_check;
ALTER TABLE profile_account_entitlements
  ADD CONSTRAINT profile_account_entitlements_product_key_check
  CHECK (product_key ~ '^[a-z0-9_]{2,80}$');
ALTER TABLE profile_account_entitlements
  DROP CONSTRAINT IF EXISTS profile_account_entitlements_status_check;
ALTER TABLE profile_account_entitlements
  ADD CONSTRAINT profile_account_entitlements_status_check
  CHECK (status IN ('pending_verification', 'active', 'suspended', 'revoked'));

COMMENT ON CONSTRAINT profile_account_entitlements_account_fk ON profile_account_entitlements IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_account_entitlements_account_product_unique ON profile_account_entitlements IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_account_entitlements_product_key_check ON profile_account_entitlements IS 'tradescout-schema:0115:v1';
COMMENT ON CONSTRAINT profile_account_entitlements_status_check ON profile_account_entitlements IS 'tradescout-schema:0115:v1';

DROP INDEX IF EXISTS idx_profile_account_entitlements_product_status;
CREATE INDEX idx_profile_account_entitlements_product_status
  ON profile_account_entitlements(product_key, status, updated_at DESC);
COMMENT ON INDEX idx_profile_account_entitlements_product_status IS 'tradescout-schema:0115:v1';

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

DROP TRIGGER IF EXISTS profile_accounts_identity_trigger
  ON profile_accounts;

CREATE TRIGGER profile_accounts_identity_trigger
BEFORE INSERT OR UPDATE OF identity_kind, business_profile_id, owner_user_id, verification_status
ON profile_accounts
FOR EACH ROW
EXECUTE FUNCTION enforce_profile_account_identity();

COMMENT ON TRIGGER profile_accounts_identity_trigger ON profile_accounts
  IS 'tradescout-schema:0115:v1';
