CREATE TABLE IF NOT EXISTS profile_offers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  title varchar(180) NOT NULL,
  description text,
  offer_type varchar(24) NOT NULL CHECK (offer_type IN ('service', 'item')),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  currency varchar(3) NOT NULL DEFAULT 'USD',
  service_category varchar(100),
  service_duration_minutes integer,
  item_sku varchar(100),
  item_stock_quantity integer,
  fulfillment_mode varchar(32) NOT NULL DEFAULT 'manual_review'
    CHECK (fulfillment_mode IN ('manual_review', 'scheduled_service', 'shipping', 'pickup', 'digital')),
  shipping_cost numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_offers_seller_active_idx
  ON profile_offers (seller_user_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS profile_offers_type_active_idx
  ON profile_offers (offer_type, is_active);

CREATE TABLE IF NOT EXISTS profile_offer_purchases (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id varchar NOT NULL REFERENCES profile_offers(id) ON DELETE restrict,
  buyer_user_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  seller_user_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  offer_type varchar(24) NOT NULL CHECK (offer_type IN ('service', 'item')),
  purchase_status varchar(32) NOT NULL DEFAULT 'review_pending'
    CHECK (purchase_status IN ('review_pending', 'accepted', 'fulfilled', 'cancelled', 'refunded')),
  payment_status varchar(32) NOT NULL DEFAULT 'not_charged'
    CHECK (payment_status IN ('not_charged', 'pending', 'paid', 'failed', 'refunded')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  shipping_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  platform_fee numeric(12,2) NOT NULL DEFAULT 1.00 CHECK (platform_fee = 1.00),
  seller_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (seller_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  currency varchar(3) NOT NULL DEFAULT 'USD',
  work_request_id varchar REFERENCES work_requests(id) ON DELETE SET NULL,
  receipt_document_id varchar REFERENCES documents(id) ON DELETE SET NULL,
  shipping_status varchar(32) DEFAULT 'not_required'
    CHECK (shipping_status IN ('not_required', 'pending', 'ready', 'shipped', 'delivered')),
  shipping_address jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_offer_purchases_buyer_idx
  ON profile_offer_purchases (buyer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS profile_offer_purchases_seller_status_idx
  ON profile_offer_purchases (seller_user_id, purchase_status, created_at DESC);

CREATE INDEX IF NOT EXISTS profile_offer_purchases_work_request_idx
  ON profile_offer_purchases (work_request_id);

CREATE INDEX IF NOT EXISTS profile_offer_purchases_receipt_idx
  ON profile_offer_purchases (receipt_document_id);
