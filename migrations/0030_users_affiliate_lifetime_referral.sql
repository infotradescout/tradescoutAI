-- Lifetime affiliate attribution: persist the referring affiliate on the user.
-- This makes commissions independent of cookies and "first action" timing.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "referred_by_affiliate_account_id" varchar
    REFERENCES "affiliate_accounts"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "referred_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_users_referred_by_affiliate"
  ON "users"("referred_by_affiliate_account_id");

-- Backfill from existing converted referrals (pick the earliest known conversion per user).
WITH first_ref AS (
  SELECT DISTINCT ON (ar.referred_user_id)
    ar.referred_user_id AS user_id,
    ar.affiliate_id AS affiliate_account_id,
    ar.created_at AS referred_at
  FROM "affiliate_referrals" ar
  WHERE ar.referred_user_id IS NOT NULL
  ORDER BY ar.referred_user_id, ar.created_at ASC
)
UPDATE "users" u
SET
  referred_by_affiliate_account_id = fr.affiliate_account_id,
  referred_at = COALESCE(u.referred_at, fr.referred_at)
FROM first_ref fr
WHERE u.id = fr.user_id
  AND u.referred_by_affiliate_account_id IS NULL;

