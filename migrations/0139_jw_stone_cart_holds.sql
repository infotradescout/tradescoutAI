-- Candidate migration: register in the canonical journal and schema checks before release.
-- Cart holds have their own origin. They never create accepted BidRock offers or paid orders.
CREATE TABLE jw_stone_cart_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL UNIQUE DEFAULT ('jwh_' || replace(gen_random_uuid()::text, '-', '')),
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_business_profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  seller_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  membership_id UUID NOT NULL REFERENCES profile_accounts(id) ON DELETE RESTRICT,
  origin TEXT NOT NULL DEFAULT 'jw_stone_member_cart' CHECK (origin = 'jw_stone_member_cart'),
  idempotency_key UUID NOT NULL,
  request_fingerprint TEXT NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','released','expired')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents > 0),
  fulfillment JSONB NOT NULL CHECK (
    jsonb_typeof(fulfillment) = 'object' AND
    COALESCE(fulfillment->>'method' IN ('pickup','delivery'), FALSE)
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  CHECK (public_id ~ '^jwh_[a-f0-9]{32}$'),
  CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '30 minutes'),
  CHECK ((status='active' AND released_at IS NULL) OR (status<>'active' AND released_at IS NOT NULL)),
  UNIQUE (seller_business_id, buyer_user_id, idempotency_key)
);
CREATE UNIQUE INDEX jw_stone_cart_holds_one_active_buyer
  ON jw_stone_cart_holds(seller_business_id,buyer_user_id) WHERE status='active';
CREATE INDEX jw_stone_cart_holds_expiration
  ON jw_stone_cart_holds(expires_at,seller_business_id) WHERE status='active';
CREATE INDEX jw_stone_cart_holds_buyer_history
  ON jw_stone_cart_holds(seller_business_id,buyer_user_id,created_at DESC);

CREATE TABLE jw_stone_cart_hold_items (
  hold_id UUID NOT NULL REFERENCES jw_stone_cart_holds(id) ON DELETE RESTRICT,
  inventory_position_id UUID NOT NULL REFERENCES stone_inventory_positions(id) ON DELETE RESTRICT,
  inventory_public_id TEXT NOT NULL REFERENCES stone_asset_passports(public_id) ON DELETE RESTRICT,
  material_name TEXT NOT NULL CHECK (char_length(material_name) BETWEEN 1 AND 180),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  unit_rate_cents INTEGER NOT NULL CHECK (unit_rate_cents > 0),
  one_slab_total_cents INTEGER NOT NULL CHECK (one_slab_total_cents > 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents > 0),
  pricing_tier TEXT NOT NULL CHECK (pricing_tier IN ('slab','bundle')),
  PRIMARY KEY (hold_id, inventory_position_id),
  UNIQUE (hold_id, inventory_public_id),
  CHECK (line_total_cents::bigint = one_slab_total_cents::bigint * quantity)
);
CREATE INDEX jw_stone_cart_hold_items_position ON jw_stone_cart_hold_items(inventory_position_id,hold_id);

CREATE FUNCTION jw_stone_cart_hold_immutable_receipt() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Cart hold receipts must be retained'; END IF;
  IF (to_jsonb(NEW) - 'status' - 'released_at') IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'released_at') THEN
    RAISE EXCEPTION 'Cart hold identity, prices, fulfillment and deadline are immutable';
  END IF;
  IF OLD.status <> 'active' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'A terminal cart hold cannot be changed or reactivated';
  END IF;
  IF NEW.status='expired' AND NEW.expires_at > clock_timestamp() THEN
    RAISE EXCEPTION 'An unexpired cart hold cannot be marked expired';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER jw_stone_cart_hold_receipt_guard
  BEFORE UPDATE OR DELETE ON jw_stone_cart_holds FOR EACH ROW
  EXECUTE FUNCTION jw_stone_cart_hold_immutable_receipt();

CREATE FUNCTION jw_stone_cart_hold_item_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Cart hold item receipts are immutable';
END $$;
CREATE TRIGGER jw_stone_cart_hold_item_guard
  BEFORE UPDATE OR DELETE ON jw_stone_cart_hold_items FOR EACH ROW
  EXECUTE FUNCTION jw_stone_cart_hold_item_immutable();
