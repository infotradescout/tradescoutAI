-- JW Stone pricing is a private business-member entitlement. Price values stay
-- in the approved Google Drive workbook and are not persisted in TradeScout.
INSERT INTO profile_account_entitlements (
  profile_account_id,
  product_key,
  status,
  created_at,
  updated_at
)
SELECT
  account.id,
  'jw_stone_member_pricing',
  CASE
    WHEN account.status <> 'active' THEN 'revoked'
    WHEN account.verification_status = 'approved'
      AND member_business.verification_status::text = 'approved' THEN 'active'
    WHEN account.verification_status = 'rejected'
      OR member_business.verification_status::text = 'rejected' THEN 'revoked'
    ELSE 'pending_verification'
  END,
  NOW(),
  NOW()
FROM profile_accounts account
INNER JOIN profiles target_profile
  ON target_profile.id = account.target_profile_id
INNER JOIN user_profiles member_business
  ON member_business.id = account.business_profile_id
WHERE target_profile.slug = 'jw-stone'
  AND account.identity_kind = 'business'
  AND member_business.user_intent::text = 'business'
ON CONFLICT (profile_account_id, product_key) DO UPDATE SET
  status = CASE
    WHEN profile_account_entitlements.status = 'suspended' THEN 'suspended'
    ELSE EXCLUDED.status
  END,
  updated_at = NOW();

