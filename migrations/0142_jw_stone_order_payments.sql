-- JW quotes/payments are separate from temporary cart reservations and contact consent.
CREATE TABLE IF NOT EXISTS jw_stone_sales (
  request_id varchar PRIMARY KEY REFERENCES work_requests(id) ON DELETE RESTRICT,
  seller_business_id varchar NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  buyer_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS jw_stone_sale_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id varchar NOT NULL REFERENCES jw_stone_sales(request_id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  actor_user_id varchar REFERENCES users(id) ON DELETE RESTRICT,
  operation_id uuid,
  fingerprint text,
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (request_id, revision),
  UNIQUE (request_id, actor_user_id, operation_id),
  CHECK ((operation_id IS NULL AND fingerprint IS NULL) OR (operation_id IS NOT NULL AND fingerprint ~ '^[a-f0-9]{64}$'))
);
CREATE INDEX IF NOT EXISTS jw_stone_sales_buyer_idx ON jw_stone_sales (buyer_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS jw_stone_sales_seller_idx ON jw_stone_sales (seller_business_id, updated_at DESC);
CREATE OR REPLACE FUNCTION jw_stone_sale_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'JW Stone sale history is append-only';
END;
$$;
DROP TRIGGER IF EXISTS jw_stone_sale_events_immutable ON jw_stone_sale_events;
CREATE TRIGGER jw_stone_sale_events_immutable BEFORE UPDATE OR DELETE ON jw_stone_sale_events
  FOR EACH ROW EXECUTE FUNCTION jw_stone_sale_history_immutable();
CREATE OR REPLACE FUNCTION jw_stone_sale_identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.request_id, NEW.seller_business_id, NEW.buyer_user_id, NEW.created_at)
    IS DISTINCT FROM ROW(OLD.request_id, OLD.seller_business_id, OLD.buyer_user_id, OLD.created_at) THEN
    RAISE EXCEPTION 'JW Stone order identity is immutable';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'JW Stone order revision must advance once';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS jw_stone_sales_identity ON jw_stone_sales;
CREATE TRIGGER jw_stone_sales_identity BEFORE UPDATE ON jw_stone_sales
  FOR EACH ROW EXECUTE FUNCTION jw_stone_sale_identity_immutable();
