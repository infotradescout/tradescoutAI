-- Enforce one affiliate account per user and clean up historical duplicates.
-- Keep the newest account per affiliate_id and remap dependent references.

WITH ranked AS (
  SELECT
    id,
    affiliate_id,
    row_number() OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS keep_id
  FROM affiliate_accounts
),
dupes AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
    AND id <> keep_id
)
UPDATE affiliate_payouts ap
SET affiliate_id = d.keep_id
FROM dupes d
WHERE ap.affiliate_id = d.id;

WITH ranked AS (
  SELECT
    id,
    affiliate_id,
    row_number() OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS keep_id
  FROM affiliate_accounts
),
dupes AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
    AND id <> keep_id
)
UPDATE affiliate_share_links asl
SET affiliate_id = d.keep_id
FROM dupes d
WHERE asl.affiliate_id = d.id;

WITH ranked AS (
  SELECT
    id,
    affiliate_id,
    row_number() OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS keep_id
  FROM affiliate_accounts
),
dupes AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
    AND id <> keep_id
)
UPDATE affiliate_referrals ar
SET affiliate_id = d.keep_id
FROM dupes d
WHERE ar.affiliate_id = d.id;

WITH ranked AS (
  SELECT
    id,
    affiliate_id,
    row_number() OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS keep_id
  FROM affiliate_accounts
),
dupes AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
    AND id <> keep_id
)
UPDATE trade_deal_clicks tdc
SET affiliate_account_id = d.keep_id
FROM dupes d
WHERE tdc.affiliate_account_id = d.id;

WITH ranked AS (
  SELECT
    id,
    affiliate_id,
    row_number() OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS keep_id
  FROM affiliate_accounts
),
dupes AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
    AND id <> keep_id
)
UPDATE trade_deal_earnings tde
SET affiliate_account_id = d.keep_id
FROM dupes d
WHERE tde.affiliate_account_id = d.id;

WITH ranked AS (
  SELECT
    id,
    affiliate_id,
    row_number() OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS keep_id
  FROM affiliate_accounts
),
dupes AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
    AND id <> keep_id
)
UPDATE users u
SET referred_by_affiliate_account_id = d.keep_id
FROM dupes d
WHERE u.referred_by_affiliate_account_id = d.id;

WITH ranked AS (
  SELECT
    id,
    affiliate_id,
    row_number() OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY affiliate_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS keep_id
  FROM affiliate_accounts
),
dupes AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM affiliate_accounts aa
USING dupes d
WHERE aa.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_accounts_affiliate_id
ON affiliate_accounts (affiliate_id);
