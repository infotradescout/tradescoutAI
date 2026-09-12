CREATE TABLE IF NOT EXISTS jw_stone_cart_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL DEFAULT ('jwr_' || replace(gen_random_uuid()::text, '-', '')),
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_business_profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  seller_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  fulfillment_method TEXT NOT NULL,
  delivery_postal_code TEXT,
  delivery_destination_type TEXT,
  subtotal_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  pricing_source_updated_at TIMESTAMPTZ NOT NULL,
  freight_quote_status TEXT NOT NULL,
  delivery_eta_status TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_user_id, idempotency_key),
  CONSTRAINT jw_stone_cart_reservations_public_id_check
    CHECK (public_id ~ '^jwr_[a-z0-9]{20,80}$'),
  CONSTRAINT jw_stone_cart_reservations_fulfillment_check
    CHECK (fulfillment_method IN ('pickup', 'delivery')),
  CONSTRAINT jw_stone_cart_reservations_delivery_fields_check
    CHECK (
      (fulfillment_method = 'pickup' AND delivery_postal_code IS NULL AND delivery_destination_type IS NULL)
      OR
      (fulfillment_method = 'delivery' AND delivery_postal_code IS NOT NULL AND delivery_destination_type IN ('business', 'jobsite'))
    ),
  CONSTRAINT jw_stone_cart_reservations_money_check
    CHECK (subtotal_cents > 0 AND currency = 'USD'),
  CONSTRAINT jw_stone_cart_reservations_quote_status_check
    CHECK (freight_quote_status IN ('not_required', 'pending_quote', 'quoted', 'unavailable')),
  CONSTRAINT jw_stone_cart_reservations_eta_status_check
    CHECK (delivery_eta_status IN ('not_required', 'pending_quote', 'quoted', 'unavailable')),
  CONSTRAINT jw_stone_cart_reservations_status_check
    CHECK (status IN ('active', 'released', 'expired', 'converted'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jw_stone_cart_reservations_public_id
  ON jw_stone_cart_reservations(public_id);
CREATE INDEX IF NOT EXISTS idx_jw_stone_cart_reservations_expiry
  ON jw_stone_cart_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_jw_stone_cart_reservations_buyer
  ON jw_stone_cart_reservations(buyer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS jw_stone_cart_reservation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES jw_stone_cart_reservations(id) ON DELETE RESTRICT,
  inventory_position_id UUID NOT NULL REFERENCES stone_inventory_positions(id) ON DELETE RESTRICT,
  inventory_public_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  material_slug TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  pricing_tier TEXT NOT NULL,
  unit_rate_cents INTEGER NOT NULL,
  one_slab_total_cents INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reservation_id, inventory_position_id),
  CONSTRAINT jw_stone_cart_reservation_items_public_id_check
    CHECK (inventory_public_id ~ '^stone_[a-f0-9]{32}$'),
  CONSTRAINT jw_stone_cart_reservation_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT jw_stone_cart_reservation_items_tier_check CHECK (pricing_tier IN ('slab', 'bundle')),
  CONSTRAINT jw_stone_cart_reservation_items_money_check
    CHECK (unit_rate_cents > 0 AND one_slab_total_cents > 0 AND line_total_cents > 0)
);

CREATE INDEX IF NOT EXISTS idx_jw_stone_cart_reservation_items_inventory
  ON jw_stone_cart_reservation_items(inventory_position_id, reservation_id);
