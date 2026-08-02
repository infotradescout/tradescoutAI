-- Lifetime affiliate attribution: persist the referring affiliate on the user.
-- This makes commissions independent of cookies and "first action" timing.

-- The original affiliate tables entered deployed databases through schema push
-- before this numbered migration existed. Reconstruct the active affiliate
-- core for clean journal installs before adding the lifetime user reference.
CREATE TABLE IF NOT EXISTS public.affiliate_accounts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  affiliate_id varchar NOT NULL REFERENCES public.users(id),
  status varchar DEFAULT 'active',
  lifetime_earned numeric DEFAULT 0,
  available numeric DEFAULT 0,
  pending numeric DEFAULT 0,
  last_payout_amount numeric DEFAULT 0,
  last_payout_at timestamp,
  referral_code varchar,
  custom_domain varchar,
  coupon_code varchar,
  commission_rate numeric(5, 4),
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_affiliate
  ON public.affiliate_accounts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_referral_code
  ON public.affiliate_accounts(referral_code);

CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  affiliate_id varchar NOT NULL REFERENCES public.affiliate_accounts(id),
  status varchar DEFAULT 'pending',
  payout_amount numeric DEFAULT 0,
  method varchar DEFAULT 'stripe',
  note text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate
  ON public.affiliate_payouts(affiliate_id);

CREATE TABLE IF NOT EXISTS public.affiliate_share_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  affiliate_id varchar NOT NULL REFERENCES public.affiliate_accounts(id),
  user_id varchar REFERENCES public.users(id),
  full_url varchar NOT NULL,
  friendly_slug varchar,
  description text,
  views integer DEFAULT 0,
  shares integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_share_links_affiliate
  ON public.affiliate_share_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_share_links_user
  ON public.affiliate_share_links(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_share_links_slug
  ON public.affiliate_share_links(friendly_slug);

CREATE TABLE IF NOT EXISTS public.affiliate_traffic_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  share_link_id varchar NOT NULL REFERENCES public.affiliate_share_links(id),
  ip_address varchar,
  user_agent text,
  device_type varchar,
  conversion_source varchar,
  conversion_type varchar,
  conversions_count integer DEFAULT 0,
  computed_conversion boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_traffic_share_link
  ON public.affiliate_traffic_events(share_link_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_traffic_conversion
  ON public.affiliate_traffic_events(conversion_type);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  affiliate_id varchar NOT NULL REFERENCES public.affiliate_accounts(id),
  referred_user_id varchar REFERENCES public.users(id),
  share_link_id varchar REFERENCES public.affiliate_share_links(id),
  custom_link varchar,
  commission_amount numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  conversion_source varchar,
  conversion_type varchar DEFAULT 'lead',
  coupon_code varchar,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate
  ON public.affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_user
  ON public.affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_share_link
  ON public.affiliate_referrals(share_link_id);

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
