-- Candidate migration; release owner must enroll this in the runtime ledger.
-- Apply exchange-stone-funnel.sql first. No production DDL is run at request time.
CREATE TABLE IF NOT EXISTS exchange_stone_inquiry_receipts (
  buyer_id varchar NOT NULL REFERENCES users(id),
  request_key text NOT NULL CHECK (length(request_key) BETWEEN 1 AND 200),
  decision_card_id varchar NOT NULL UNIQUE REFERENCES decision_cards(id),
  listing_id varchar NOT NULL REFERENCES marketplace_listings(id),
  seller_id varchar NOT NULL REFERENCES users(id),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  inquiry_id varchar NOT NULL REFERENCES marketplace_inquiries(id),
  response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, request_key),
  CHECK (buyer_id <> seller_id)
);
CREATE INDEX IF NOT EXISTS exchange_stone_inquiry_legacy_retry
  ON exchange_stone_inquiry_receipts (buyer_id, listing_id, seller_id, fingerprint, created_at DESC);
