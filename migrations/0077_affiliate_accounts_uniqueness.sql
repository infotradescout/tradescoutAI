-- Enforce one affiliate account per user and clean up historical duplicates.
-- Keep the newest account per affiliate_id and remap dependent references.

-- TradeDeal tables also predated their first numbered migration in deployed
-- databases. Reconstruct the active family before remapping affiliate links.
CREATE TABLE IF NOT EXISTS public.trade_deals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  slug varchar(120) UNIQUE,
  name varchar(255) NOT NULL,
  partner_name varchar(255) NOT NULL,
  description text,
  landing_url varchar(1024) NOT NULL,
  default_commission_rate numeric(5, 4),
  is_recurring boolean DEFAULT true,
  is_active boolean DEFAULT true,
  category varchar(100),
  created_by varchar REFERENCES public.users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_deals_slug_idx ON public.trade_deals(slug);
CREATE INDEX IF NOT EXISTS trade_deals_active_idx ON public.trade_deals(is_active);

CREATE TABLE IF NOT EXISTS public.trade_deal_clicks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  trade_deal_id varchar NOT NULL REFERENCES public.trade_deals(id),
  user_id varchar REFERENCES public.users(id),
  affiliate_account_id varchar REFERENCES public.affiliate_accounts(id),
  source varchar(100),
  landing_path varchar(1024),
  external_tracking_id varchar(255),
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_deal_clicks_deal_idx
  ON public.trade_deal_clicks(trade_deal_id);
CREATE INDEX IF NOT EXISTS trade_deal_clicks_user_idx
  ON public.trade_deal_clicks(user_id);
CREATE INDEX IF NOT EXISTS trade_deal_clicks_affiliate_idx
  ON public.trade_deal_clicks(affiliate_account_id);

CREATE TABLE IF NOT EXISTS public.trade_deal_earnings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  trade_deal_id varchar NOT NULL REFERENCES public.trade_deals(id),
  affiliate_account_id varchar REFERENCES public.affiliate_accounts(id),
  user_id varchar REFERENCES public.users(id),
  amount numeric(14, 2) NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'USD',
  period_label varchar(32),
  source_type varchar(50) DEFAULT 'partner_report',
  external_reference varchar(255),
  notes text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_deal_earnings_deal_idx
  ON public.trade_deal_earnings(trade_deal_id);
CREATE INDEX IF NOT EXISTS trade_deal_earnings_affiliate_idx
  ON public.trade_deal_earnings(affiliate_account_id);
CREATE INDEX IF NOT EXISTS trade_deal_earnings_user_idx
  ON public.trade_deal_earnings(user_id);
CREATE INDEX IF NOT EXISTS trade_deal_earnings_period_idx
  ON public.trade_deal_earnings(period_label);

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
