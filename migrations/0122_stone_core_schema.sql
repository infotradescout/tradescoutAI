-- Stone Core is migration-owned. Runtime services verify this schema but never create it.
CREATE TABLE IF NOT EXISTS stone_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  material_class TEXT NOT NULL DEFAULT 'natural_stone',
  material_family TEXT NOT NULL,
  source_business_id TEXT NOT NULL,
  source_profile_slug TEXT NOT NULL,
  source_url TEXT NOT NULL,
  primary_image_url TEXT,
  quarry_country TEXT,
  quarry_region TEXT,
  source_status TEXT NOT NULL DEFAULT 'source_verified',
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stone_materials_source_slug_unique
  ON stone_materials(source_business_id, slug);

ALTER TABLE stone_materials
  DROP CONSTRAINT IF EXISTS stone_materials_material_class_check;
ALTER TABLE stone_materials
  ADD CONSTRAINT stone_materials_material_class_check
  CHECK (material_class IN ('natural_stone', 'engineered_stone')) NOT VALID;
ALTER TABLE stone_materials
  VALIDATE CONSTRAINT stone_materials_material_class_check;

ALTER TABLE stone_materials DROP CONSTRAINT IF EXISTS stone_materials_slug_key;

CREATE INDEX IF NOT EXISTS idx_stone_materials_source_business
  ON stone_materials(source_business_id, canonical_name);
CREATE INDEX IF NOT EXISTS idx_stone_materials_family
  ON stone_materials(material_family, canonical_name);

CREATE TABLE IF NOT EXISTS stone_asset_passports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT,
  passport_code TEXT NOT NULL UNIQUE,
  material_id UUID NOT NULL REFERENCES stone_materials(id) ON DELETE RESTRICT,
  asset_kind TEXT NOT NULL,
  source_business_id TEXT NOT NULL,
  custody_business_id TEXT,
  source_asset_ref TEXT,
  dimensions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  passport_status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stone_asset_passports ADD COLUMN IF NOT EXISTS public_id TEXT;
UPDATE stone_asset_passports
   SET public_id = 'stone_' || md5(id::text || ':public:v1')
 WHERE public_id IS NULL OR btrim(public_id) = '';
ALTER TABLE stone_asset_passports
  ALTER COLUMN public_id SET DEFAULT ('stone_' || replace(gen_random_uuid()::text, '-', ''));
ALTER TABLE stone_asset_passports ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stone_asset_passports_public_id_unique
  ON stone_asset_passports(public_id);
CREATE INDEX IF NOT EXISTS idx_stone_asset_passports_material
  ON stone_asset_passports(material_id, passport_status);

CREATE OR REPLACE FUNCTION enforce_stone_passport_material_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.material_id IS DISTINCT FROM OLD.material_id THEN
    RAISE EXCEPTION
      'Stone passport material identity is immutable; retire the asset and create a new passport';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stone_asset_passports_material_identity_trigger
  ON stone_asset_passports;
CREATE TRIGGER stone_asset_passports_material_identity_trigger
BEFORE UPDATE OF material_id ON stone_asset_passports
FOR EACH ROW EXECUTE FUNCTION enforce_stone_passport_material_identity();

CREATE TABLE IF NOT EXISTS stone_inventory_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_passport_id UUID NOT NULL REFERENCES stone_asset_passports(id) ON DELETE CASCADE,
  holder_business_id TEXT NOT NULL,
  location_ref TEXT,
  lifecycle_status TEXT NOT NULL,
  quantity NUMERIC,
  held_quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  public_availability_status TEXT NOT NULL DEFAULT 'not_published',
  publication_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stone_inventory_positions ADD COLUMN IF NOT EXISTS held_quantity NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE stone_inventory_positions ADD COLUMN IF NOT EXISTS publication_evidence JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE stone_inventory_positions ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE stone_inventory_positions ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS stone_inventory_position_dedup_audit (
  duplicate_position_id UUID PRIMARY KEY,
  survivor_position_id UUID NOT NULL,
  asset_passport_id UUID NOT NULL,
  holder_business_id TEXT NOT NULL,
  duplicate_snapshot JSONB NOT NULL,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

WITH ranked AS (
  SELECT ip.*,
         first_value(ip.id) OVER (
           PARTITION BY ip.asset_passport_id, ip.holder_business_id
           ORDER BY ip.updated_at DESC, ip.created_at DESC, ip.id
         ) AS survivor_id,
         row_number() OVER (
           PARTITION BY ip.asset_passport_id, ip.holder_business_id
           ORDER BY ip.updated_at DESC, ip.created_at DESC, ip.id
         ) AS duplicate_rank
    FROM stone_inventory_positions ip
)
INSERT INTO stone_inventory_position_dedup_audit (
  duplicate_position_id,
  survivor_position_id,
  asset_passport_id,
  holder_business_id,
  duplicate_snapshot
)
SELECT id,
       survivor_id,
       asset_passport_id,
       holder_business_id,
       to_jsonb(ranked) - 'survivor_id' - 'duplicate_rank'
  FROM ranked
 WHERE duplicate_rank > 1
ON CONFLICT (duplicate_position_id) DO NOTHING;

WITH grouped AS (
  SELECT asset_passport_id,
         holder_business_id,
         (array_agg(id ORDER BY updated_at DESC, created_at DESC, id))[1] AS survivor_id,
         max(quantity) AS retained_quantity,
         max(held_quantity) AS retained_held_quantity
    FROM stone_inventory_positions
   GROUP BY asset_passport_id, holder_business_id
  HAVING count(*) > 1
)
UPDATE stone_inventory_positions ip
   SET quantity = grouped.retained_quantity,
       held_quantity = least(
         coalesce(grouped.retained_held_quantity, 0),
         coalesce(grouped.retained_quantity, 0)
       ),
       updated_at = NOW(),
       version = ip.version + 1
  FROM grouped
 WHERE ip.id = grouped.survivor_id;

DELETE FROM stone_inventory_positions ip
 USING stone_inventory_position_dedup_audit audit
 WHERE ip.id = audit.duplicate_position_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stone_inventory_positions_passport_holder_unique'
       AND conrelid = 'stone_inventory_positions'::regclass
  ) THEN
    ALTER TABLE stone_inventory_positions
      ADD CONSTRAINT stone_inventory_positions_passport_holder_unique
      UNIQUE (asset_passport_id, holder_business_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stone_inventory_positions_quantity_hold_check'
       AND conrelid = 'stone_inventory_positions'::regclass
  ) THEN
    ALTER TABLE stone_inventory_positions
      ADD CONSTRAINT stone_inventory_positions_quantity_hold_check
      CHECK (
        held_quantity >= 0
        AND (quantity IS NULL OR quantity >= 0)
        AND (quantity IS NULL OR held_quantity <= quantity)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stone_inventory_positions_holder
  ON stone_inventory_positions(holder_business_id, lifecycle_status);

CREATE TABLE IF NOT EXISTS stone_inventory_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  delegate_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  delegate_business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  granted_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((delegate_user_id IS NULL) <> (delegate_business_id IS NULL)),
  CHECK (status IN ('active', 'revoked')),
  CHECK (scopes <@ ARRAY['inventory_read', 'inventory_write', 'inventory_publish']::TEXT[])
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stone_inventory_delegations_user_unique
  ON stone_inventory_delegations(holder_business_id, delegate_user_id)
  WHERE delegate_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stone_inventory_delegations_business_unique
  ON stone_inventory_delegations(holder_business_id, delegate_business_id)
  WHERE delegate_business_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stone_distribution_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_business_id TEXT NOT NULL,
  distributor_business_id TEXT NOT NULL,
  right_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  exclusivity TEXT NOT NULL,
  territory_status TEXT NOT NULL,
  territory_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  relationship_status TEXT NOT NULL,
  verified_by_user_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_business_id, distributor_business_id, right_type, scope)
);
CREATE INDEX IF NOT EXISTS idx_stone_distribution_rights_distributor
  ON stone_distribution_rights(distributor_business_id, relationship_status);

CREATE TABLE IF NOT EXISTS stone_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES stone_materials(id) ON DELETE CASCADE,
  publisher_business_id TEXT NOT NULL,
  profile_slug TEXT NOT NULL,
  channel TEXT NOT NULL,
  publication_role TEXT NOT NULL,
  visibility TEXT NOT NULL,
  publication_status TEXT NOT NULL,
  inventory_claim TEXT NOT NULL DEFAULT 'none',
  published_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, profile_slug, channel)
);
CREATE INDEX IF NOT EXISTS idx_stone_publications_profile
  ON stone_publications(profile_slug, publication_status, channel);

CREATE OR REPLACE VIEW stone_core_material_map AS
SELECT
  m.id AS material_id,
  m.slug AS material_slug,
  m.canonical_name,
  m.material_family,
  m.source_business_id,
  m.source_profile_slug,
  m.source_status,
  p.publisher_business_id,
  p.profile_slug AS publication_profile_slug,
  p.channel,
  p.publication_role,
  p.visibility,
  p.publication_status,
  p.inventory_claim,
  EXISTS (
    SELECT 1
      FROM stone_inventory_positions ip
      INNER JOIN stone_asset_passports ap ON ap.id = ip.asset_passport_id
     WHERE ap.material_id = m.id
  ) AS has_inventory_position
FROM stone_materials m
LEFT JOIN stone_publications p ON p.material_id = m.id;
