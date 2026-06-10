CREATE TABLE IF NOT EXISTS affiliate_attribution_conversions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_event_id varchar NOT NULL UNIQUE,
  affiliate_tag varchar NOT NULL,
  source varchar NOT NULL,
  attribution_proof_type varchar NOT NULL,
  attribution_proof text NOT NULL,
  conversion_type varchar NOT NULL,
  target_path varchar,
  target_id varchar,
  occurred_at timestamp NOT NULL DEFAULT now(),
  status varchar NOT NULL DEFAULT 'recorded',
  payout_eligible boolean NOT NULL DEFAULT false,
  payout_calculated boolean NOT NULL DEFAULT false,
  payment_triggered boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_attr_conv_tag
  ON affiliate_attribution_conversions (affiliate_tag);

CREATE INDEX IF NOT EXISTS idx_affiliate_attr_conv_type
  ON affiliate_attribution_conversions (conversion_type);

CREATE INDEX IF NOT EXISTS idx_affiliate_attr_conv_occurred
  ON affiliate_attribution_conversions (occurred_at);
