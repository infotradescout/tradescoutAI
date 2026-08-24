-- BidRock lifecycle and canonical links are migration-owned.
ALTER TABLE marketplace_transactions
  ADD COLUMN IF NOT EXISTS marketplace_reference TEXT;
ALTER TABLE marketplace_transactions
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION enforce_bidrock_marketplace_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.marketplace_reference LIKE 'bidrock:%'
     OR OLD.metadata ? 'bidrockOrderId' THEN
    IF NEW.marketplace_reference IS DISTINCT FROM OLD.marketplace_reference
       OR NEW.metadata->>'bidrockOrderId' IS DISTINCT FROM OLD.metadata->>'bidrockOrderId'
       OR NEW.metadata->>'bidrockOrderPublicId' IS DISTINCT FROM OLD.metadata->>'bidrockOrderPublicId'
       OR NEW.metadata->>'bidrockListingPublicId' IS DISTINCT FROM OLD.metadata->>'bidrockListingPublicId'
       OR NEW.metadata->>'sourceChannel' IS DISTINCT FROM OLD.metadata->>'sourceChannel' THEN
      RAISE EXCEPTION 'BidRock canonical marketplace provenance is immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_transactions_bidrock_provenance_trigger
  ON marketplace_transactions;
CREATE TRIGGER marketplace_transactions_bidrock_provenance_trigger
BEFORE UPDATE OF marketplace_reference, metadata
ON marketplace_transactions
FOR EACH ROW EXECUTE FUNCTION enforce_bidrock_marketplace_provenance();

CREATE TABLE IF NOT EXISTS bidrock_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL DEFAULT ('brl_' || replace(gen_random_uuid()::text, '-', '')),
  inventory_position_id UUID NOT NULL UNIQUE REFERENCES stone_inventory_positions(id) ON DELETE RESTRICT,
  asset_passport_id UUID NOT NULL REFERENCES stone_asset_passports(id) ON DELETE RESTRICT,
  material_id UUID NOT NULL REFERENCES stone_materials(id) ON DELETE RESTRICT,
  source_profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  source_profile_slug TEXT NOT NULL,
  source_profile_name TEXT NOT NULL,
  seller_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  material_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  material_family TEXT,
  image_url TEXT,
  dimensions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  finish_quantities JSONB NOT NULL DEFAULT '[]'::jsonb,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  last_confirmed_at TIMESTAMPTZ NOT NULL,
  confirmation_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  price_unit TEXT,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_visibility TEXT NOT NULL DEFAULT 'verified_business',
  payment_method TEXT NOT NULL DEFAULT 'ach',
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('draft', 'active', 'reserved', 'sold', 'archived')),
  CHECK (price_unit IS NULL OR price_unit IN ('sqft', 'slab')),
  CHECK (price_cents IS NULL OR price_cents > 0),
  CHECK ((price_cents IS NULL) = (price_unit IS NULL)),
  CHECK (currency = 'USD'),
  CHECK (price_visibility = 'verified_business'),
  CHECK (payment_method = 'ach')
);

-- Upgrade the earlier catalog-backed foundation without relabeling photo records as stock.
-- Legacy rows are retained as audit evidence, then removed from the transactional listing table.
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS inventory_position_id UUID;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS asset_passport_id UUID;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS public_id TEXT;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS dimensions_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS finish_quantities JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS quantity NUMERIC;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS bidrock_legacy_listing_audit (
  legacy_listing_id UUID PRIMARY KEY,
  legacy_snapshot JSONB NOT NULL,
  audit_reason TEXT NOT NULL,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO bidrock_legacy_listing_audit (legacy_listing_id, legacy_snapshot, audit_reason)
SELECT listing.id,
       to_jsonb(listing),
       'catalog_record_without_canonical_physical_stock'
  FROM bidrock_listings listing
 WHERE listing.inventory_position_id IS NULL
    OR listing.asset_passport_id IS NULL
    OR listing.material_id IS NULL
    OR listing.seller_business_id IS NULL
    OR listing.quantity IS NULL
    OR listing.unit IS NULL
    OR listing.last_confirmed_at IS NULL
    OR listing.confirmation_expires_at IS NULL
ON CONFLICT (legacy_listing_id) DO NOTHING;

DELETE FROM bidrock_listings listing
 WHERE listing.inventory_position_id IS NULL
    OR listing.asset_passport_id IS NULL
    OR listing.material_id IS NULL
    OR listing.seller_business_id IS NULL
    OR listing.quantity IS NULL
    OR listing.unit IS NULL
    OR listing.last_confirmed_at IS NULL
    OR listing.confirmation_expires_at IS NULL;

-- Remove fields owned by the rejected catalog-backed and revenue-specific foundation.
ALTER TABLE bidrock_listings DROP COLUMN IF EXISTS sold_listing_fee_cents;
ALTER TABLE bidrock_listings DROP COLUMN IF EXISTS source_key;
ALTER TABLE bidrock_listings DROP COLUMN IF EXISTS source_kind;
ALTER TABLE bidrock_listings DROP COLUMN IF EXISTS source_item_slug;
ALTER TABLE bidrock_listings DROP COLUMN IF EXISTS public_summary;
ALTER TABLE bidrock_listings DROP COLUMN IF EXISTS pricing_mode;

DO $$
DECLARE
  foreign_key RECORD;
BEGIN
  FOR foreign_key IN
    SELECT DISTINCT constraint_record.conname
      FROM pg_constraint constraint_record
      INNER JOIN pg_attribute attribute_record
        ON attribute_record.attrelid = constraint_record.conrelid
       AND attribute_record.attnum = ANY(constraint_record.conkey)
     WHERE constraint_record.conrelid = 'bidrock_listings'::regclass
       AND constraint_record.contype = 'f'
       AND attribute_record.attname IN (
         'inventory_position_id', 'asset_passport_id', 'material_id',
         'source_profile_id', 'seller_business_id'
       )
  LOOP
    EXECUTE format('ALTER TABLE bidrock_listings DROP CONSTRAINT %I', foreign_key.conname);
  END LOOP;
END $$;

ALTER TABLE bidrock_listings
  ALTER COLUMN inventory_position_id SET NOT NULL,
  ALTER COLUMN asset_passport_id SET NOT NULL,
  ALTER COLUMN material_id SET NOT NULL,
  ALTER COLUMN seller_business_id SET NOT NULL,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN unit SET NOT NULL,
  ALTER COLUMN last_confirmed_at SET NOT NULL,
  ALTER COLUMN confirmation_expires_at SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE bidrock_listings DROP CONSTRAINT IF EXISTS bidrock_listings_status_check;
ALTER TABLE bidrock_listings
  ADD CONSTRAINT bidrock_listings_status_check
  CHECK (status IN ('draft', 'active', 'reserved', 'sold', 'archived'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bidrock_listings_inventory_position_fk'
       AND conrelid = 'bidrock_listings'::regclass
  ) THEN
    ALTER TABLE bidrock_listings
      ADD CONSTRAINT bidrock_listings_inventory_position_fk
      FOREIGN KEY (inventory_position_id) REFERENCES stone_inventory_positions(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bidrock_listings_asset_passport_fk'
       AND conrelid = 'bidrock_listings'::regclass
  ) THEN
    ALTER TABLE bidrock_listings
      ADD CONSTRAINT bidrock_listings_asset_passport_fk
      FOREIGN KEY (asset_passport_id) REFERENCES stone_asset_passports(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bidrock_listings_material_fk'
       AND conrelid = 'bidrock_listings'::regclass
  ) THEN
    ALTER TABLE bidrock_listings
      ADD CONSTRAINT bidrock_listings_material_fk
      FOREIGN KEY (material_id) REFERENCES stone_materials(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bidrock_listings_source_profile_fk'
       AND conrelid = 'bidrock_listings'::regclass
  ) THEN
    ALTER TABLE bidrock_listings
      ADD CONSTRAINT bidrock_listings_source_profile_fk
      FOREIGN KEY (source_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bidrock_listings_seller_business_fk'
       AND conrelid = 'bidrock_listings'::regclass
  ) THEN
    ALTER TABLE bidrock_listings
      ADD CONSTRAINT bidrock_listings_seller_business_fk
      FOREIGN KEY (seller_business_id) REFERENCES businesses(id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS public_id TEXT;
CREATE TABLE IF NOT EXISTS bidrock_listing_public_id_audit (
  listing_id UUID PRIMARY KEY,
  previous_public_id TEXT,
  replacement_public_id TEXT NOT NULL,
  audit_reason TEXT NOT NULL,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade legacy identifiers before uniqueness/format validation. Duplicate and malformed
-- identifiers are remapped deterministically from the immutable internal listing identity.
CREATE TEMP TABLE bidrock_listing_public_id_repair_queue AS
WITH ranked AS (
  SELECT id,
         public_id,
         row_number() OVER (
           PARTITION BY public_id
           ORDER BY created_at, id
         ) AS duplicate_rank
    FROM bidrock_listings
)
SELECT id,
       public_id,
       CASE
         WHEN public_id IS NULL OR btrim(public_id) = '' THEN 'missing'
         WHEN public_id !~ '^brl_[a-z0-9]{20,80}$' THEN 'invalid_format'
         ELSE 'duplicate'
       END AS audit_reason
  FROM ranked
 WHERE public_id IS NULL
    OR btrim(public_id) = ''
    OR public_id !~ '^brl_[a-z0-9]{20,80}$'
    OR duplicate_rank > 1;

DO $$
DECLARE
  repair RECORD;
  attempt INTEGER;
  candidate TEXT;
BEGIN
  FOR repair IN
    SELECT * FROM bidrock_listing_public_id_repair_queue ORDER BY id
  LOOP
    attempt := 0;
    LOOP
      candidate := 'brl_' || md5(repair.id::text || ':public:v2:' || attempt::text);
      EXIT WHEN NOT EXISTS (
        SELECT 1
          FROM bidrock_listings listing
         WHERE listing.public_id = candidate
           AND listing.id <> repair.id
      );
      attempt := attempt + 1;
    END LOOP;

    INSERT INTO bidrock_listing_public_id_audit (
      listing_id, previous_public_id, replacement_public_id, audit_reason
    ) VALUES (
      repair.id, repair.public_id, candidate, repair.audit_reason
    )
    ON CONFLICT (listing_id) DO UPDATE
      SET previous_public_id = EXCLUDED.previous_public_id,
          replacement_public_id = EXCLUDED.replacement_public_id,
          audit_reason = EXCLUDED.audit_reason,
          audited_at = NOW();

    UPDATE bidrock_listings SET public_id = candidate WHERE id = repair.id;
  END LOOP;
END $$;
DROP TABLE bidrock_listing_public_id_repair_queue;

ALTER TABLE bidrock_listings
  ALTER COLUMN public_id SET DEFAULT ('brl_' || replace(gen_random_uuid()::text, '-', ''));
ALTER TABLE bidrock_listings ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE bidrock_listings DROP CONSTRAINT IF EXISTS bidrock_listings_public_id_format_check;
ALTER TABLE bidrock_listings
  ADD CONSTRAINT bidrock_listings_public_id_format_check
  CHECK (public_id ~ '^brl_[a-z0-9]{20,80}$') NOT VALID;
ALTER TABLE bidrock_listings
  VALIDATE CONSTRAINT bidrock_listings_public_id_format_check;
ALTER TABLE bidrock_listings ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_index index_record
      INNER JOIN pg_class index_class ON index_class.oid = index_record.indexrelid
      INNER JOIN pg_namespace namespace ON namespace.oid = index_class.relnamespace
     WHERE index_class.relname = 'idx_bidrock_listings_public_id_unique'
       AND namespace.nspname = 'public'
       AND (index_record.indisunique = FALSE
         OR index_record.indisvalid = FALSE
         OR index_record.indisready = FALSE)
  ) THEN
    DROP INDEX idx_bidrock_listings_public_id_unique;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_listings_public_id_unique ON bidrock_listings(public_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_listings_inventory_position_unique
  ON bidrock_listings(inventory_position_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_listings_passport_unique ON bidrock_listings(asset_passport_id);
CREATE INDEX IF NOT EXISTS idx_bidrock_listings_market
  ON bidrock_listings(status, material_family, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bidrock_listings_seller
  ON bidrock_listings(seller_business_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS bidrock_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES bidrock_listings(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_price_unit TEXT,
  previous_price_cents INTEGER,
  next_price_unit TEXT,
  next_price_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (previous_price_unit IS NULL OR previous_price_unit IN ('sqft', 'slab')),
  CHECK (next_price_unit IS NULL OR next_price_unit IN ('sqft', 'slab'))
);

CREATE TABLE IF NOT EXISTS bidrock_saved_listings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES bidrock_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS bidrock_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES bidrock_listings(id) ON DELETE RESTRICT,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_business_profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  total_amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'submitted',
  message TEXT,
  parent_offer_id UUID REFERENCES bidrock_offers(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT,
  idempotency_history JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_user_id, idempotency_key),
  CHECK (quantity > 0),
  CHECK (total_amount_cents > 0),
  CHECK (currency = 'USD'),
  CHECK (status IN ('submitted', 'countered', 'accepted', 'rejected', 'withdrawn', 'expired'))
);
ALTER TABLE bidrock_offers ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
ALTER TABLE bidrock_offers ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_bidrock_offers_listing
  ON bidrock_offers(listing_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS bidrock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES bidrock_listings(id) ON DELETE RESTRICT,
  accepted_offer_id UUID NOT NULL UNIQUE REFERENCES bidrock_offers(id) ON DELETE RESTRICT,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (quantity > 0),
  CHECK (status IN ('active', 'released', 'converted', 'expired'))
);
ALTER TABLE bidrock_reservations ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_reservations_active_listing
  ON bidrock_reservations(listing_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bidrock_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT NOT NULL DEFAULT ('bro_' || replace(gen_random_uuid()::text, '-', '')),
  listing_id UUID NOT NULL REFERENCES bidrock_listings(id) ON DELETE RESTRICT,
  listing_public_id TEXT NOT NULL REFERENCES bidrock_listings(public_id) ON DELETE RESTRICT,
  accepted_offer_id UUID NOT NULL UNIQUE REFERENCES bidrock_offers(id) ON DELETE RESTRICT,
  reservation_id UUID NOT NULL UNIQUE REFERENCES bidrock_reservations(id) ON DELETE RESTRICT,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_business_profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  seller_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'reservation_active',
  payment_method TEXT NOT NULL DEFAULT 'ach',
  canonical_marketplace_listing_id TEXT,
  canonical_marketplace_transaction_id TEXT,
  canonical_procurement_order_id TEXT,
  payment_readiness JSONB NOT NULL DEFAULT '{}'::jsonb,
  reservation_expires_at TIMESTAMPTZ NOT NULL,
  inventory_effect_status TEXT NOT NULL DEFAULT 'held',
  paid_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (quantity > 0),
  CHECK (subtotal_cents > 0),
  CHECK (currency = 'USD'),
  CHECK (payment_method = 'ach'),
  CHECK (inventory_effect_status IN ('held', 'released', 'consumed')),
  CHECK (status IN (
    'reservation_active', 'payment_ready', 'payment_processing', 'paid', 'freight',
    'custody_transferred', 'fabrication', 'installation_handoff', 'completed',
    'cancelled', 'expired'
  ))
);
ALTER TABLE bidrock_orders ADD COLUMN IF NOT EXISTS public_id TEXT;
UPDATE bidrock_orders
   SET public_id = 'bro_' || md5(id::text || ':public:v1')
 WHERE public_id IS NULL OR btrim(public_id) = '';
ALTER TABLE bidrock_orders
  ALTER COLUMN public_id SET DEFAULT ('bro_' || replace(gen_random_uuid()::text, '-', ''));
ALTER TABLE bidrock_orders ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_orders_public_id_unique
  ON bidrock_orders(public_id);
ALTER TABLE bidrock_orders ADD COLUMN IF NOT EXISTS listing_public_id TEXT;
UPDATE bidrock_orders orders
   SET listing_public_id = listing.public_id
  FROM bidrock_listings listing
 WHERE listing.id = orders.listing_id
   AND orders.listing_public_id IS NULL;
ALTER TABLE bidrock_orders ALTER COLUMN listing_public_id SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint constraint_record
      INNER JOIN pg_attribute attribute_record
        ON attribute_record.attrelid = constraint_record.conrelid
       AND attribute_record.attnum = ANY(constraint_record.conkey)
     WHERE constraint_record.conrelid = 'bidrock_orders'::regclass
       AND constraint_record.contype = 'f'
       AND attribute_record.attname = 'listing_public_id'
  ) THEN
    ALTER TABLE bidrock_orders
      ADD CONSTRAINT bidrock_orders_listing_public_id_fk
      FOREIGN KEY (listing_public_id) REFERENCES bidrock_listings(public_id) ON DELETE RESTRICT;
  END IF;
END $$;
ALTER TABLE bidrock_orders DROP CONSTRAINT IF EXISTS bidrock_orders_listing_public_id_format_check;
ALTER TABLE bidrock_orders
  ADD CONSTRAINT bidrock_orders_listing_public_id_format_check
  CHECK (listing_public_id ~ '^brl_[a-z0-9]{20,80}$');
ALTER TABLE bidrock_orders DROP CONSTRAINT IF EXISTS bidrock_orders_public_id_format_check;
ALTER TABLE bidrock_orders
  ADD CONSTRAINT bidrock_orders_public_id_format_check
  CHECK (public_id ~ '^bro_[a-z0-9]{20,80}$');
ALTER TABLE bidrock_orders ADD COLUMN IF NOT EXISTS canonical_marketplace_listing_id TEXT;
ALTER TABLE bidrock_orders ADD COLUMN IF NOT EXISTS inventory_effect_status TEXT NOT NULL DEFAULT 'held';
ALTER TABLE bidrock_orders ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
ALTER TABLE bidrock_orders ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE bidrock_orders DROP CONSTRAINT IF EXISTS bidrock_orders_status_check;
ALTER TABLE bidrock_orders
  ADD CONSTRAINT bidrock_orders_status_check CHECK (status IN (
    'reservation_active', 'payment_ready', 'payment_processing', 'paid', 'freight',
    'custody_transferred', 'fabrication', 'installation_handoff', 'completed',
    'cancelled', 'expired'
  ));
ALTER TABLE bidrock_orders DROP CONSTRAINT IF EXISTS bidrock_orders_inventory_effect_status_check;
ALTER TABLE bidrock_orders
  ADD CONSTRAINT bidrock_orders_inventory_effect_status_check
  CHECK (inventory_effect_status IN ('held', 'released', 'consumed'));

CREATE TABLE IF NOT EXISTS bidrock_canonical_link_dedup_audit (
  order_id UUID NOT NULL REFERENCES bidrock_orders(id) ON DELETE CASCADE,
  link_kind TEXT NOT NULL,
  canonical_id TEXT NOT NULL,
  survivor_order_id UUID NOT NULL REFERENCES bidrock_orders(id) ON DELETE CASCADE,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, link_kind)
);

WITH duplicate_links AS (
  SELECT id AS order_id,
         canonical_marketplace_listing_id AS canonical_id,
         first_value(id) OVER (
           PARTITION BY canonical_marketplace_listing_id ORDER BY created_at, id
         ) AS survivor_order_id,
         row_number() OVER (
           PARTITION BY canonical_marketplace_listing_id ORDER BY created_at, id
         ) AS duplicate_rank
    FROM bidrock_orders
   WHERE canonical_marketplace_listing_id IS NOT NULL
)
INSERT INTO bidrock_canonical_link_dedup_audit (order_id, link_kind, canonical_id, survivor_order_id)
SELECT order_id, 'marketplace_listing', canonical_id, survivor_order_id
  FROM duplicate_links WHERE duplicate_rank > 1
ON CONFLICT (order_id, link_kind) DO NOTHING;

WITH duplicate_links AS (
  SELECT id AS order_id,
         canonical_marketplace_transaction_id AS canonical_id,
         first_value(id) OVER (
           PARTITION BY canonical_marketplace_transaction_id ORDER BY created_at, id
         ) AS survivor_order_id,
         row_number() OVER (
           PARTITION BY canonical_marketplace_transaction_id ORDER BY created_at, id
         ) AS duplicate_rank
    FROM bidrock_orders
   WHERE canonical_marketplace_transaction_id IS NOT NULL
)
INSERT INTO bidrock_canonical_link_dedup_audit (order_id, link_kind, canonical_id, survivor_order_id)
SELECT order_id, 'marketplace_transaction', canonical_id, survivor_order_id
  FROM duplicate_links WHERE duplicate_rank > 1
ON CONFLICT (order_id, link_kind) DO NOTHING;

WITH duplicate_links AS (
  SELECT id AS order_id,
         canonical_procurement_order_id AS canonical_id,
         first_value(id) OVER (
           PARTITION BY canonical_procurement_order_id ORDER BY created_at, id
         ) AS survivor_order_id,
         row_number() OVER (
           PARTITION BY canonical_procurement_order_id ORDER BY created_at, id
         ) AS duplicate_rank
    FROM bidrock_orders
   WHERE canonical_procurement_order_id IS NOT NULL
)
INSERT INTO bidrock_canonical_link_dedup_audit (order_id, link_kind, canonical_id, survivor_order_id)
SELECT order_id, 'procurement_order', canonical_id, survivor_order_id
  FROM duplicate_links WHERE duplicate_rank > 1
ON CONFLICT (order_id, link_kind) DO NOTHING;

UPDATE bidrock_orders orders
   SET canonical_marketplace_listing_id = NULL, updated_at = NOW(), version = orders.version + 1
  FROM bidrock_canonical_link_dedup_audit audit
 WHERE audit.order_id = orders.id AND audit.link_kind = 'marketplace_listing';
UPDATE bidrock_orders orders
   SET canonical_marketplace_transaction_id = NULL, updated_at = NOW(), version = orders.version + 1
  FROM bidrock_canonical_link_dedup_audit audit
 WHERE audit.order_id = orders.id AND audit.link_kind = 'marketplace_transaction';
UPDATE bidrock_orders orders
   SET canonical_procurement_order_id = NULL, updated_at = NOW(), version = orders.version + 1
  FROM bidrock_canonical_link_dedup_audit audit
 WHERE audit.order_id = orders.id AND audit.link_kind = 'procurement_order';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_orders_marketplace_listing_unique
  ON bidrock_orders(canonical_marketplace_listing_id)
  WHERE canonical_marketplace_listing_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_orders_marketplace_transaction_unique
  ON bidrock_orders(canonical_marketplace_transaction_id)
  WHERE canonical_marketplace_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_orders_procurement_order_unique
  ON bidrock_orders(canonical_procurement_order_id)
  WHERE canonical_procurement_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bidrock_orders_parties
  ON bidrock_orders(buyer_user_id, seller_business_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS bidrock_inventory_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_position_id UUID NOT NULL REFERENCES stone_inventory_positions(id) ON DELETE RESTRICT,
  reservation_id UUID NOT NULL UNIQUE REFERENCES bidrock_reservations(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL UNIQUE REFERENCES bidrock_orders(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'held',
  held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (quantity > 0),
  CHECK (status IN ('held', 'released', 'consumed'))
);
ALTER TABLE bidrock_inventory_allocations ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bidrock_inventory_allocations ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE bidrock_inventory_allocations ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;
ALTER TABLE bidrock_inventory_allocations ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_bidrock_inventory_allocations_position
  ON bidrock_inventory_allocations(inventory_position_id, status);

INSERT INTO bidrock_inventory_allocations (
  inventory_position_id, reservation_id, order_id, quantity, status, held_at, created_at, updated_at
)
SELECT listing.inventory_position_id,
       orders.reservation_id,
       orders.id,
       orders.quantity,
       CASE
         WHEN orders.status = 'completed' THEN 'consumed'
         WHEN orders.status IN ('cancelled', 'expired') THEN 'released'
         ELSE 'held'
       END,
       orders.created_at,
       orders.created_at,
       NOW()
  FROM bidrock_orders orders
  INNER JOIN bidrock_listings listing ON listing.id = orders.listing_id
ON CONFLICT (order_id) DO NOTHING;

WITH held AS (
  SELECT inventory_position_id, sum(quantity) AS held_quantity
    FROM bidrock_inventory_allocations
   WHERE status = 'held'
   GROUP BY inventory_position_id
)
UPDATE stone_inventory_positions inventory
   SET held_quantity = least(coalesce(inventory.quantity, held.held_quantity), held.held_quantity),
       version = inventory.version + 1,
       updated_at = NOW()
  FROM held
 WHERE inventory.id = held.inventory_position_id;

CREATE TABLE IF NOT EXISTS bidrock_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bidrock_orders(id) ON DELETE CASCADE,
  handoff_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  responsible_business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  provider_name TEXT,
  reference TEXT,
  scheduled_for TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, idempotency_key),
  CHECK (handoff_type IN ('freight', 'custody', 'fabrication', 'installation_homeid')),
  CHECK (status IN ('pending', 'in_progress', 'completed'))
);
ALTER TABLE bidrock_handoffs ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bidrock_handoffs ADD COLUMN IF NOT EXISTS request_fingerprint TEXT;
ALTER TABLE bidrock_handoffs ADD COLUMN IF NOT EXISTS idempotency_history JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bidrock_handoffs ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS bidrock_handoff_dedup_audit (
  handoff_id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  handoff_type TEXT NOT NULL,
  handoff_snapshot JSONB NOT NULL,
  survivor_handoff_id UUID NOT NULL,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fail closed if legacy replay history already associates one key with two requests.
DO $$
DECLARE
  replay_conflict RECORD;
BEGIN
  SELECT order_id, handoff_type, idempotency_key
    INTO replay_conflict
    FROM bidrock_handoffs
   WHERE jsonb_typeof(idempotency_history) = 'object'
     AND idempotency_history ? idempotency_key
     AND idempotency_history->>idempotency_key IS DISTINCT FROM COALESCE(request_fingerprint, '')
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION
      'Conflicting BidRock handoff replay history for order %, type %, key %',
      replay_conflict.order_id,
      replay_conflict.handoff_type,
      replay_conflict.idempotency_key;
  END IF;

  WITH replay_entries AS (
    SELECT handoff.order_id,
           handoff.handoff_type,
           replay.key,
           replay.value AS fingerprint
      FROM bidrock_handoffs handoff
      CROSS JOIN LATERAL jsonb_each_text(
        (CASE
          WHEN jsonb_typeof(handoff.idempotency_history) = 'object'
            THEN handoff.idempotency_history
          ELSE '{}'::jsonb
        END) || jsonb_build_object(
          handoff.idempotency_key,
          COALESCE(handoff.request_fingerprint, '')
        )
      ) replay
  )
  SELECT order_id, handoff_type, key
    INTO replay_conflict
    FROM replay_entries
   GROUP BY order_id, handoff_type, key
  HAVING count(DISTINCT fingerprint) > 1
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION
      'Conflicting duplicate BidRock handoff replay history for order %, type %, key %',
      replay_conflict.order_id,
      replay_conflict.handoff_type,
      replay_conflict.key;
  END IF;
END $$;

-- The replayed order outcome is separate from the request fingerprint. Preserve only
-- status evidence that is actually present in legacy handoff metadata and fail closed
-- when duplicate rows associate the same retry key with different outcomes.
DO $$
DECLARE
  replay_status_conflict RECORD;
BEGIN
  WITH replay_status_entries AS (
    SELECT handoff.order_id,
           handoff.handoff_type,
           replay_status.key,
           replay_status.value AS order_status
      FROM bidrock_handoffs handoff
      CROSS JOIN LATERAL jsonb_each(
        CASE
          WHEN jsonb_typeof(handoff.metadata->'_bidrockReplayOrderStatuses') = 'object'
            THEN handoff.metadata->'_bidrockReplayOrderStatuses'
          ELSE '{}'::jsonb
        END
      ) replay_status
  )
  SELECT order_id, handoff_type, key
    INTO replay_status_conflict
    FROM replay_status_entries
   GROUP BY order_id, handoff_type, key
  HAVING count(DISTINCT order_status) > 1
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION
      'Conflicting duplicate BidRock handoff replay order status for order %, type %, key %',
      replay_status_conflict.order_id,
      replay_status_conflict.handoff_type,
      replay_status_conflict.key;
  END IF;
END $$;

WITH ranked_handoffs AS (
  SELECT handoff.*,
         first_value(id) OVER (
           PARTITION BY order_id, handoff_type
           ORDER BY CASE status WHEN 'completed' THEN 2 WHEN 'in_progress' THEN 1 ELSE 0 END DESC,
                    updated_at DESC, id
         ) AS survivor_handoff_id,
         row_number() OVER (
           PARTITION BY order_id, handoff_type
           ORDER BY CASE status WHEN 'completed' THEN 2 WHEN 'in_progress' THEN 1 ELSE 0 END DESC,
                    updated_at DESC, id
         ) AS duplicate_rank
    FROM bidrock_handoffs handoff
)
INSERT INTO bidrock_handoff_dedup_audit (
  handoff_id, order_id, handoff_type, handoff_snapshot, survivor_handoff_id
)
SELECT id, order_id, handoff_type, to_jsonb(ranked_handoffs), survivor_handoff_id
  FROM ranked_handoffs
 WHERE duplicate_rank > 1
ON CONFLICT (handoff_id) DO NOTHING;

-- Merge the full replay history into the survivor before removing any duplicate row.
WITH ranked_handoffs AS (
  SELECT handoff.*,
         first_value(id) OVER (
           PARTITION BY order_id, handoff_type
           ORDER BY CASE status WHEN 'completed' THEN 2 WHEN 'in_progress' THEN 1 ELSE 0 END DESC,
                    updated_at DESC, id
         ) AS survivor_handoff_id
    FROM bidrock_handoffs handoff
), replay_entries AS (
  SELECT ranked.survivor_handoff_id,
         replay.key,
         replay.value AS fingerprint
    FROM ranked_handoffs ranked
    CROSS JOIN LATERAL jsonb_each_text(
      (CASE
        WHEN jsonb_typeof(ranked.idempotency_history) = 'object'
          THEN ranked.idempotency_history
        ELSE '{}'::jsonb
      END) || jsonb_build_object(
        ranked.idempotency_key,
        COALESCE(ranked.request_fingerprint, '')
      )
    ) replay
), merged_history AS (
  SELECT survivor_handoff_id,
         jsonb_object_agg(key, fingerprint ORDER BY key) AS idempotency_history
    FROM replay_entries
   GROUP BY survivor_handoff_id
)
UPDATE bidrock_handoffs survivor
   SET idempotency_history = merged.idempotency_history,
       updated_at = NOW()
  FROM merged_history merged
 WHERE survivor.id = merged.survivor_handoff_id;

-- Merge only replay-order statuses present in the legacy rows. Do not manufacture
-- outcomes for keys that lack this historical evidence.
WITH ranked_handoffs AS (
  SELECT handoff.*,
         first_value(id) OVER (
           PARTITION BY order_id, handoff_type
           ORDER BY CASE status WHEN 'completed' THEN 2 WHEN 'in_progress' THEN 1 ELSE 0 END DESC,
                    updated_at DESC, id
         ) AS survivor_handoff_id
    FROM bidrock_handoffs handoff
), replay_status_entries AS (
  SELECT ranked.survivor_handoff_id,
         replay_status.key,
         replay_status.value AS order_status
    FROM ranked_handoffs ranked
    CROSS JOIN LATERAL jsonb_each(
      CASE
        WHEN jsonb_typeof(ranked.metadata->'_bidrockReplayOrderStatuses') = 'object'
          THEN ranked.metadata->'_bidrockReplayOrderStatuses'
        ELSE '{}'::jsonb
      END
    ) replay_status
), merged_status_history AS (
  SELECT survivor_handoff_id,
         jsonb_object_agg(key, order_status ORDER BY key) AS replay_order_statuses
    FROM replay_status_entries
   GROUP BY survivor_handoff_id
)
UPDATE bidrock_handoffs survivor
   SET metadata = jsonb_set(
         CASE WHEN jsonb_typeof(survivor.metadata) = 'object' THEN survivor.metadata ELSE '{}'::jsonb END,
         '{_bidrockReplayOrderStatuses}',
         merged.replay_order_statuses,
         TRUE
       ),
       updated_at = NOW()
  FROM merged_status_history merged
 WHERE survivor.id = merged.survivor_handoff_id;

DELETE FROM bidrock_handoffs handoff
 USING bidrock_handoff_dedup_audit audit
 WHERE handoff.id = audit.handoff_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_handoffs_order_type_unique
  ON bidrock_handoffs(order_id, handoff_type);

CREATE TABLE IF NOT EXISTS bidrock_order_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES bidrock_orders(id) ON DELETE CASCADE,
  provider_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  provider_business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  handoff_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  granted_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((provider_user_id IS NULL) <> (provider_business_id IS NULL)),
  CHECK (status IN ('active', 'revoked')),
  CHECK (handoff_types <@ ARRAY['freight', 'custody', 'fabrication', 'installation_homeid']::TEXT[])
);
ALTER TABLE bidrock_order_delegations ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_order_delegations_user_unique
  ON bidrock_order_delegations(order_id, provider_user_id)
  WHERE provider_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bidrock_order_delegations_business_unique
  ON bidrock_order_delegations(order_id, provider_business_id)
  WHERE provider_business_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_bidrock_immutable_links()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'bidrock_listings' THEN
    IF NEW.public_id IS DISTINCT FROM OLD.public_id
       OR NEW.inventory_position_id IS DISTINCT FROM OLD.inventory_position_id
       OR NEW.asset_passport_id IS DISTINCT FROM OLD.asset_passport_id
       OR NEW.material_id IS DISTINCT FROM OLD.material_id
       OR NEW.seller_business_id IS DISTINCT FROM OLD.seller_business_id THEN
      RAISE EXCEPTION 'BidRock listing canonical inventory links are immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.canonical_marketplace_transaction_id IS NOT NULL
     AND NEW.canonical_marketplace_transaction_id IS DISTINCT FROM OLD.canonical_marketplace_transaction_id THEN
    RAISE EXCEPTION 'BidRock marketplace transaction link is immutable';
  END IF;
  IF NEW.listing_public_id IS DISTINCT FROM OLD.listing_public_id THEN
    RAISE EXCEPTION 'BidRock order public listing identity is immutable';
  END IF;
  IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
    RAISE EXCEPTION 'BidRock order public identity is immutable';
  END IF;
  IF OLD.canonical_procurement_order_id IS NOT NULL
     AND NEW.canonical_procurement_order_id IS DISTINCT FROM OLD.canonical_procurement_order_id THEN
    RAISE EXCEPTION 'BidRock procurement order link is immutable';
  END IF;
  IF OLD.canonical_marketplace_listing_id IS NOT NULL
     AND NEW.canonical_marketplace_listing_id IS DISTINCT FROM OLD.canonical_marketplace_listing_id THEN
    RAISE EXCEPTION 'BidRock marketplace listing link is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bidrock_listings_immutable_links_trigger ON bidrock_listings;
CREATE TRIGGER bidrock_listings_immutable_links_trigger
BEFORE UPDATE OF public_id, inventory_position_id, asset_passport_id, material_id, seller_business_id
ON bidrock_listings FOR EACH ROW EXECUTE FUNCTION enforce_bidrock_immutable_links();

DROP TRIGGER IF EXISTS bidrock_orders_immutable_links_trigger ON bidrock_orders;
CREATE TRIGGER bidrock_orders_immutable_links_trigger
BEFORE UPDATE OF public_id, listing_public_id, canonical_marketplace_listing_id, canonical_marketplace_transaction_id, canonical_procurement_order_id
ON bidrock_orders FOR EACH ROW EXECUTE FUNCTION enforce_bidrock_immutable_links();

CREATE OR REPLACE FUNCTION enforce_bidrock_handoff_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_rank INTEGER;
  new_rank INTEGER;
BEGIN
  IF NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.handoff_type IS DISTINCT FROM OLD.handoff_type THEN
    RAISE EXCEPTION 'BidRock handoff order and type are immutable';
  END IF;

  old_rank := CASE OLD.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'completed' THEN 2 ELSE -1 END;
  new_rank := CASE NEW.status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'completed' THEN 2 ELSE -1 END;
  IF new_rank < old_rank OR new_rank > old_rank + 1 THEN
    RAISE EXCEPTION 'BidRock handoff lifecycle must advance one stage at a time';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bidrock_handoffs_lifecycle_trigger ON bidrock_handoffs;
CREATE TRIGGER bidrock_handoffs_lifecycle_trigger
BEFORE UPDATE OF order_id, handoff_type, status
ON bidrock_handoffs FOR EACH ROW EXECUTE FUNCTION enforce_bidrock_handoff_lifecycle();
