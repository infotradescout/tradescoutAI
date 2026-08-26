-- Affiliate commission approval must be financially real, idempotent, and auditable.
-- Existing positive rows cannot be proven uncredited, so quarantine them. Never
-- destructively rewrite historical wallet balances.

ALTER TABLE affiliate_referrals
  ADD COLUMN IF NOT EXISTS commission_status varchar(32),
  ADD COLUMN IF NOT EXISTS commission_reference_id varchar(255),
  ADD COLUMN IF NOT EXISTS commission_revenue_amount numeric(14, 2),
  ADD COLUMN IF NOT EXISTS commission_description text,
  ADD COLUMN IF NOT EXISTS commission_source_referral_id varchar,
  ADD COLUMN IF NOT EXISTS commission_approved_at timestamp,
  ADD COLUMN IF NOT EXISTS commission_approved_by varchar,
  ADD COLUMN IF NOT EXISTS commission_approval_reason text,
  ADD COLUMN IF NOT EXISTS commission_paid_at timestamp;

UPDATE affiliate_referrals
SET commission_status = 'legacy_unverified'
WHERE coalesce(commission_amount, '0')::numeric > 0
  AND commission_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliate_referrals_commission_status_check'
  ) THEN
    ALTER TABLE affiliate_referrals
      ADD CONSTRAINT affiliate_referrals_commission_status_check
      CHECK (
        commission_status IS NULL
        OR commission_status IN ('legacy_unverified', 'pending', 'approved', 'paid')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliate_referrals_commission_source_fk'
  ) THEN
    ALTER TABLE affiliate_referrals
      ADD CONSTRAINT affiliate_referrals_commission_source_fk
      FOREIGN KEY (commission_source_referral_id)
      REFERENCES affiliate_referrals(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliate_referrals_commission_approved_by_fk'
  ) THEN
    ALTER TABLE affiliate_referrals
      ADD CONSTRAINT affiliate_referrals_commission_approved_by_fk
      FOREIGN KEY (commission_approved_by)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_affiliate_referrals_commission_reference
  ON affiliate_referrals (affiliate_id, commission_reference_id)
  WHERE commission_reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_commission_status
  ON affiliate_referrals (affiliate_id, commission_status);

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_commission_source
  ON affiliate_referrals (commission_source_referral_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_affiliate_commission_credit
  ON wallet_transactions (user_id, reference_id)
  WHERE transaction_type = 'affiliate_commission'
    AND direction = 'credit'
    AND reference_type = 'affiliate_commission';

-- Intentionally no DEFAULT 'pending'. During rolling deploys, legacy application
-- writes remain NULL/legacy-unverified and fail closed instead of being credited twice.
