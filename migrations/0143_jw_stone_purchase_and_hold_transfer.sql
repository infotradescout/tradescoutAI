-- Additive only: no price, feature, customer or stock rows are seeded or changed.
CREATE TABLE jw_stone_purchase_requests (
  request_id TEXT PRIMARY KEY REFERENCES work_requests(id) ON DELETE RESTRICT,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  operation_id UUID NOT NULL,
  fingerprint TEXT NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  intake JSONB NOT NULL CHECK (jsonb_typeof(intake)='object' AND intake->>'intent'='purchase' AND NOT (intake ? 'offeredTotalCents')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (seller_business_id,buyer_user_id,operation_id)
);
CREATE INDEX jw_stone_purchase_requests_buyer ON jw_stone_purchase_requests(buyer_user_id,created_at DESC);

CREATE TABLE jw_stone_sale_hold_transfers (
  hold_id UUID PRIMARY KEY REFERENCES jw_stone_cart_holds(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL UNIQUE REFERENCES jw_stone_sales(request_id) ON DELETE RESTRICT,
  attempt_id UUID NOT NULL UNIQUE,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  transferred_at TIMESTAMPTZ NOT NULL
);
CREATE FUNCTION jw_stone_purchase_receipt_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Purchase and reservation transfer receipts are immutable'; END $$;
CREATE TRIGGER jw_stone_purchase_receipt_guard BEFORE UPDATE OR DELETE ON jw_stone_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION jw_stone_purchase_receipt_immutable();
CREATE TRIGGER jw_stone_hold_transfer_receipt_guard BEFORE UPDATE OR DELETE ON jw_stone_sale_hold_transfers
  FOR EACH ROW EXECUTE FUNCTION jw_stone_purchase_receipt_immutable();

CREATE FUNCTION jw_stone_purchase_identity_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM work_requests w JOIN profiles p ON p.id=w.source_ref_id
    WHERE w.id=NEW.request_id AND w.created_by_user_id=NEW.buyer_user_id
      AND w.source='direct_connect' AND w.visibility='private' AND p.slug='jw-stone' AND p.business_id=NEW.seller_business_id) THEN
    RAISE EXCEPTION 'Purchase request identity does not match its private buyer and seller';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER jw_stone_purchase_identity BEFORE INSERT ON jw_stone_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION jw_stone_purchase_identity_guard();

-- Deferred so receipt insertion and the serialized checkout event commit together.
CREATE FUNCTION jw_stone_hold_transfer_identity_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE h jw_stone_cart_holds%ROWTYPE; s jw_stone_sales%ROWTYPE; item_count INTEGER;
BEGIN
  SELECT * INTO h FROM jw_stone_cart_holds WHERE id=NEW.hold_id;
  SELECT * INTO s FROM jw_stone_sales WHERE request_id=NEW.request_id;
  IF h.buyer_user_id IS DISTINCT FROM NEW.buyer_user_id OR s.buyer_user_id IS DISTINCT FROM NEW.buyer_user_id OR
     h.seller_business_id IS DISTINCT FROM NEW.seller_business_id OR s.seller_business_id IS DISTINCT FROM NEW.seller_business_id OR
     h.status IS DISTINCT FROM 'released' OR h.released_at IS DISTINCT FROM NEW.transferred_at OR
     s.state->'attempt'->>'id' IS DISTINCT FROM NEW.attempt_id::text OR
     s.state->'reservationTransfer'->>'reservationId' IS DISTINCT FROM h.public_id THEN
    RAISE EXCEPTION 'Reservation transfer does not match its order, owner and payment attempt';
  END IF;
  SELECT count(*) INTO item_count FROM jw_stone_cart_hold_items WHERE hold_id=NEW.hold_id;
  IF item_count=0 OR jsonb_array_length(s.state->'allocations') IS DISTINCT FROM item_count OR EXISTS (
    SELECT 1 FROM jw_stone_cart_hold_items i WHERE i.hold_id=NEW.hold_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.state->'allocations') a
      WHERE a->>'positionId'=i.inventory_position_id::text AND a->>'inventoryPublicId'=i.inventory_public_id
        AND (a->>'quantity')::INTEGER=i.quantity
    )
  ) THEN RAISE EXCEPTION 'Reservation transfer must preserve every original stock allocation'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER jw_stone_hold_transfer_identity AFTER INSERT ON jw_stone_sale_hold_transfers
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION jw_stone_hold_transfer_identity_guard();
