ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS shipping_quote jsonb,
  ADD COLUMN IF NOT EXISTS package_details jsonb,
  ADD COLUMN IF NOT EXISTS listing_type varchar DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS bundle_purchase_mode varchar DEFAULT 'must_buy_all',
  ADD COLUMN IF NOT EXISTS bundle_items jsonb,
  ADD COLUMN IF NOT EXISTS value_guidance jsonb,
  ADD COLUMN IF NOT EXISTS rarity_tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rarity_confidence varchar,
  ADD COLUMN IF NOT EXISTS rarity_sample_size integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rarity_explanation text;

DO $$ BEGIN
  CREATE TYPE marketplace_order_status AS ENUM (
    'item_sold',
    'payment_received',
    'label_pending',
    'label_purchased',
    'in_transit',
    'delivered',
    'payout_reconciled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id varchar NOT NULL REFERENCES marketplace_listings(id),
  transaction_id varchar REFERENCES marketplace_transactions(id),
  buyer_id varchar REFERENCES users(id),
  seller_id varchar NOT NULL REFERENCES users(id),
  status marketplace_order_status NOT NULL DEFAULT 'item_sold',
  shipping_quote jsonb,
  tracking_number varchar,
  label_url varchar,
  payout_deduction_amount numeric(10, 2) DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_orders_listing_idx ON marketplace_orders(listing_id);
CREATE INDEX IF NOT EXISTS marketplace_orders_seller_idx ON marketplace_orders(seller_id);
CREATE INDEX IF NOT EXISTS marketplace_orders_buyer_idx ON marketplace_orders(buyer_id);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_orders_listing_unique ON marketplace_orders(listing_id);
