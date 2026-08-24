-- BidRock timed auctions extend the canonical listing, reservation, allocation, and ACH order path.
-- Historical negotiated offers remain readable; new auction outcomes never fabricate offer rows.

CREATE SEQUENCE IF NOT EXISTS bidrock_auction_lot_number_seq;

CREATE TABLE IF NOT EXISTS bidrock_auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL DEFAULT ('bra_' || replace(gen_random_uuid()::text, '-', '')),
  lot_number TEXT NOT NULL DEFAULT ('BR-' || lpad(nextval('bidrock_auction_lot_number_seq')::text, 6, '0')),
  listing_id UUID NOT NULL REFERENCES bidrock_listings(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  opening_bid_cents INTEGER NOT NULL,
  reserve_bid_cents INTEGER,
  minimum_increment_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  original_ends_at TIMESTAMPTZ NOT NULL,
  soft_close_seconds INTEGER NOT NULL DEFAULT 120,
  pickup_terms TEXT NOT NULL,
  freight_terms TEXT NOT NULL,
  configured_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  winner_bid_id UUID,
  reservation_id UUID,
  order_id UUID,
  closed_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bidrock_auctions_public_id_format_check
    CHECK (public_id ~ '^bra_[a-z0-9]{20,80}$'),
  CONSTRAINT bidrock_auctions_lot_number_format_check
    CHECK (lot_number ~ '^BR-[0-9]{6,12}$'),
  CONSTRAINT bidrock_auctions_status_check
    CHECK (status IN ('scheduled', 'live', 'extended', 'ended', 'no_sale', 'sold')),
  CONSTRAINT bidrock_auctions_positive_values_check
    CHECK (
      opening_bid_cents > 0
      AND minimum_increment_cents > 0
      AND (reserve_bid_cents IS NULL OR reserve_bid_cents >= opening_bid_cents)
    ),
  CONSTRAINT bidrock_auctions_time_order_check
    CHECK (starts_at < original_ends_at AND original_ends_at <= ends_at),
  CONSTRAINT bidrock_auctions_soft_close_check CHECK (soft_close_seconds = 120),
  CONSTRAINT bidrock_auctions_terms_check
    CHECK (char_length(btrim(pickup_terms)) > 0 AND char_length(btrim(freight_terms)) > 0),
  CONSTRAINT bidrock_auctions_currency_check CHECK (currency = 'USD')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_auctions_public_id_unique
  ON bidrock_auctions(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_auctions_lot_number_unique
  ON bidrock_auctions(lot_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_auctions_one_current_per_listing
  ON bidrock_auctions(listing_id)
  WHERE status IN ('scheduled', 'live', 'extended', 'ended');
CREATE INDEX IF NOT EXISTS idx_bidrock_auctions_market
  ON bidrock_auctions(status, ends_at, starts_at);

CREATE TABLE IF NOT EXISTS bidrock_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accepted_sequence BIGSERIAL NOT NULL UNIQUE,
  auction_id UUID NOT NULL REFERENCES bidrock_auctions(id) ON DELETE RESTRICT,
  bidder_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  bidder_business_profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  max_amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bidrock_bids_positive_max_check CHECK (max_amount_cents > 0),
  CONSTRAINT bidrock_bids_currency_check CHECK (currency = 'USD'),
  CONSTRAINT bidrock_bids_idempotency_key_check CHECK (char_length(btrim(idempotency_key)) >= 8),
  UNIQUE (auction_id, bidder_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bidrock_bids_auction_sequence
  ON bidrock_bids(auction_id, accepted_sequence);
CREATE INDEX IF NOT EXISTS idx_bidrock_bids_bidder_latest
  ON bidrock_bids(auction_id, bidder_user_id, accepted_sequence DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_bids_accepted_sequence_unique
  ON bidrock_bids(accepted_sequence);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_bids_idempotency_unique
  ON bidrock_bids(auction_id, bidder_user_id, idempotency_key);

-- Auction closure reuses the existing commercial chain. Exactly one origin is permitted:
-- a retained historical offer or a timed-auction winner.
ALTER TABLE bidrock_reservations
  ALTER COLUMN accepted_offer_id DROP NOT NULL;
ALTER TABLE bidrock_reservations
  ADD COLUMN IF NOT EXISTS auction_id UUID;
ALTER TABLE bidrock_reservations
  ADD COLUMN IF NOT EXISTS winning_bid_id UUID;
ALTER TABLE bidrock_reservations
  DROP CONSTRAINT IF EXISTS bidrock_reservations_auction_id_fkey;
ALTER TABLE bidrock_reservations
  DROP CONSTRAINT IF EXISTS bidrock_reservations_auction_fk;
ALTER TABLE bidrock_reservations
  ADD CONSTRAINT bidrock_reservations_auction_fk
  FOREIGN KEY (auction_id) REFERENCES bidrock_auctions(id) ON DELETE RESTRICT;
ALTER TABLE bidrock_reservations
  DROP CONSTRAINT IF EXISTS bidrock_reservations_winning_bid_id_fkey;
ALTER TABLE bidrock_reservations
  DROP CONSTRAINT IF EXISTS bidrock_reservations_winning_bid_fk;
ALTER TABLE bidrock_reservations
  ADD CONSTRAINT bidrock_reservations_winning_bid_fk
  FOREIGN KEY (winning_bid_id) REFERENCES bidrock_bids(id) ON DELETE RESTRICT;
ALTER TABLE bidrock_reservations
  DROP CONSTRAINT IF EXISTS bidrock_reservations_origin_check;
ALTER TABLE bidrock_reservations
  ADD CONSTRAINT bidrock_reservations_origin_check
  CHECK (
    (accepted_offer_id IS NOT NULL AND auction_id IS NULL AND winning_bid_id IS NULL)
    OR (accepted_offer_id IS NULL AND auction_id IS NOT NULL AND winning_bid_id IS NOT NULL)
  ) NOT VALID;
ALTER TABLE bidrock_reservations
  VALIDATE CONSTRAINT bidrock_reservations_origin_check;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_reservations_auction_unique
  ON bidrock_reservations(auction_id) WHERE auction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_reservations_winning_bid_unique
  ON bidrock_reservations(winning_bid_id) WHERE winning_bid_id IS NOT NULL;

ALTER TABLE bidrock_orders
  ALTER COLUMN accepted_offer_id DROP NOT NULL;
ALTER TABLE bidrock_orders
  ADD COLUMN IF NOT EXISTS auction_id UUID;
ALTER TABLE bidrock_orders
  ADD COLUMN IF NOT EXISTS winning_bid_id UUID;
ALTER TABLE bidrock_orders
  DROP CONSTRAINT IF EXISTS bidrock_orders_auction_id_fkey;
ALTER TABLE bidrock_orders
  DROP CONSTRAINT IF EXISTS bidrock_orders_auction_fk;
ALTER TABLE bidrock_orders
  ADD CONSTRAINT bidrock_orders_auction_fk
  FOREIGN KEY (auction_id) REFERENCES bidrock_auctions(id) ON DELETE RESTRICT;
ALTER TABLE bidrock_orders
  DROP CONSTRAINT IF EXISTS bidrock_orders_winning_bid_id_fkey;
ALTER TABLE bidrock_orders
  DROP CONSTRAINT IF EXISTS bidrock_orders_winning_bid_fk;
ALTER TABLE bidrock_orders
  ADD CONSTRAINT bidrock_orders_winning_bid_fk
  FOREIGN KEY (winning_bid_id) REFERENCES bidrock_bids(id) ON DELETE RESTRICT;
ALTER TABLE bidrock_orders
  DROP CONSTRAINT IF EXISTS bidrock_orders_origin_check;
ALTER TABLE bidrock_orders
  ADD CONSTRAINT bidrock_orders_origin_check
  CHECK (
    (accepted_offer_id IS NOT NULL AND auction_id IS NULL AND winning_bid_id IS NULL)
    OR (accepted_offer_id IS NULL AND auction_id IS NOT NULL AND winning_bid_id IS NOT NULL)
  ) NOT VALID;
ALTER TABLE bidrock_orders
  VALIDATE CONSTRAINT bidrock_orders_origin_check;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_orders_auction_unique
  ON bidrock_orders(auction_id) WHERE auction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_orders_winning_bid_unique
  ON bidrock_orders(winning_bid_id) WHERE winning_bid_id IS NOT NULL;

ALTER TABLE bidrock_auctions DROP CONSTRAINT IF EXISTS bidrock_auctions_winner_bid_fk;
ALTER TABLE bidrock_auctions
  ADD CONSTRAINT bidrock_auctions_winner_bid_fk
  FOREIGN KEY (winner_bid_id) REFERENCES bidrock_bids(id) ON DELETE RESTRICT;
ALTER TABLE bidrock_auctions DROP CONSTRAINT IF EXISTS bidrock_auctions_reservation_fk;
ALTER TABLE bidrock_auctions
  ADD CONSTRAINT bidrock_auctions_reservation_fk
  FOREIGN KEY (reservation_id) REFERENCES bidrock_reservations(id) ON DELETE RESTRICT;
ALTER TABLE bidrock_auctions DROP CONSTRAINT IF EXISTS bidrock_auctions_order_fk;
ALTER TABLE bidrock_auctions
  ADD CONSTRAINT bidrock_auctions_order_fk
  FOREIGN KEY (order_id) REFERENCES bidrock_orders(id) ON DELETE RESTRICT;
ALTER TABLE bidrock_auctions DROP CONSTRAINT IF EXISTS bidrock_auctions_close_outcome_check;
ALTER TABLE bidrock_auctions
  ADD CONSTRAINT bidrock_auctions_close_outcome_check
  CHECK (
    (status = 'sold' AND winner_bid_id IS NOT NULL AND reservation_id IS NOT NULL AND order_id IS NOT NULL AND closed_at IS NOT NULL)
    OR (status = 'no_sale' AND winner_bid_id IS NULL AND reservation_id IS NULL AND order_id IS NULL AND closed_at IS NOT NULL)
    OR (status NOT IN ('sold', 'no_sale') AND winner_bid_id IS NULL AND reservation_id IS NULL AND order_id IS NULL)
  ) NOT VALID;
ALTER TABLE bidrock_auctions
  VALIDATE CONSTRAINT bidrock_auctions_close_outcome_check;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_auctions_winner_bid_unique
  ON bidrock_auctions(winner_bid_id) WHERE winner_bid_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_auctions_reservation_unique
  ON bidrock_auctions(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_auctions_order_unique
  ON bidrock_auctions(order_id) WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_bidrock_auction_origin_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.accepted_offer_id IS DISTINCT FROM OLD.accepted_offer_id
     OR NEW.auction_id IS DISTINCT FROM OLD.auction_id
     OR NEW.winning_bid_id IS DISTINCT FROM OLD.winning_bid_id THEN
    RAISE EXCEPTION 'BidRock order or reservation origin is immutable';
  END IF;
  IF TG_TABLE_NAME = 'bidrock_orders' THEN
    IF NEW.reservation_id IS DISTINCT FROM OLD.reservation_id THEN
      RAISE EXCEPTION 'BidRock order reservation is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bidrock_reservations_immutable_origin_trigger ON bidrock_reservations;
CREATE TRIGGER bidrock_reservations_immutable_origin_trigger
BEFORE UPDATE OF listing_id, accepted_offer_id, auction_id, winning_bid_id
ON bidrock_reservations FOR EACH ROW EXECUTE FUNCTION enforce_bidrock_auction_origin_immutability();
DROP TRIGGER IF EXISTS bidrock_orders_immutable_origin_trigger ON bidrock_orders;
CREATE TRIGGER bidrock_orders_immutable_origin_trigger
BEFORE UPDATE OF listing_id, accepted_offer_id, auction_id, winning_bid_id, reservation_id
ON bidrock_orders FOR EACH ROW EXECUTE FUNCTION enforce_bidrock_auction_origin_immutability();

CREATE OR REPLACE FUNCTION enforce_bidrock_auction_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'bidrock_bids' THEN
    RAISE EXCEPTION 'BidRock accepted bids are immutable';
  END IF;

  IF NEW.public_id IS DISTINCT FROM OLD.public_id
     OR NEW.lot_number IS DISTINCT FROM OLD.lot_number
     OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.configured_by_user_id IS DISTINCT FROM OLD.configured_by_user_id THEN
    RAISE EXCEPTION 'BidRock auction identity is immutable';
  END IF;
  IF OLD.status IN ('sold', 'no_sale') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Closed BidRock auction outcomes are immutable';
  END IF;
  IF OLD.winner_bid_id IS NOT NULL AND NEW.winner_bid_id IS DISTINCT FROM OLD.winner_bid_id THEN
    RAISE EXCEPTION 'BidRock auction winner is immutable';
  END IF;
  IF OLD.reservation_id IS NOT NULL AND NEW.reservation_id IS DISTINCT FROM OLD.reservation_id THEN
    RAISE EXCEPTION 'BidRock auction reservation is immutable';
  END IF;
  IF OLD.order_id IS NOT NULL AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'BidRock auction order is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bidrock_bids_immutable_update_trigger ON bidrock_bids;
CREATE TRIGGER bidrock_bids_immutable_update_trigger
BEFORE UPDATE ON bidrock_bids
FOR EACH ROW EXECUTE FUNCTION enforce_bidrock_auction_immutability();
DROP TRIGGER IF EXISTS bidrock_bids_immutable_delete_trigger ON bidrock_bids;
CREATE TRIGGER bidrock_bids_immutable_delete_trigger
BEFORE DELETE ON bidrock_bids
FOR EACH ROW EXECUTE FUNCTION enforce_bidrock_auction_immutability();
DROP TRIGGER IF EXISTS bidrock_auctions_immutable_identity_trigger ON bidrock_auctions;
CREATE TRIGGER bidrock_auctions_immutable_identity_trigger
BEFORE UPDATE ON bidrock_auctions
FOR EACH ROW EXECUTE FUNCTION enforce_bidrock_auction_immutability();
