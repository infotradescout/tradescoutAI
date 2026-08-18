import { sql } from "drizzle-orm";
import {
  STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT,
  STONE_CORE_RED_GRANITI_MATERIALS,
  STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS,
  STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
} from "@shared/stoneCore";
import { pool } from "../db";

const STONE_CORE_DDL = `
CREATE TABLE IF NOT EXISTS stone_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
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

CREATE INDEX IF NOT EXISTS idx_stone_materials_source_business
  ON stone_materials(source_business_id, canonical_name);

CREATE INDEX IF NOT EXISTS idx_stone_materials_family
  ON stone_materials(material_family, canonical_name);

CREATE TABLE IF NOT EXISTS stone_asset_passports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX IF NOT EXISTS idx_stone_asset_passports_material
  ON stone_asset_passports(material_id, passport_status);

CREATE TABLE IF NOT EXISTS stone_inventory_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_passport_id UUID NOT NULL REFERENCES stone_asset_passports(id) ON DELETE CASCADE,
  holder_business_id TEXT NOT NULL,
  location_ref TEXT,
  lifecycle_status TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  public_availability_status TEXT NOT NULL DEFAULT 'not_published',
  received_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stone_inventory_positions_holder
  ON stone_inventory_positions(holder_business_id, lifecycle_status);

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
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM stone_inventory_positions ip
      INNER JOIN stone_asset_passports ap ON ap.id = ip.asset_passport_id
      WHERE ap.material_id = m.id
    ) THEN TRUE
    ELSE FALSE
  END AS has_inventory_position
FROM stone_materials m
LEFT JOIN stone_publications p ON p.material_id = m.id;
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureStoneCoreTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = pool.query(STONE_CORE_DDL).then(() => undefined);
  }
  return ensurePromise;
}

type StoneCoreTransaction = {
  execute: (query: unknown) => Promise<unknown>;
};

/**
 * Installs one canonical material record per source material, one independent
 * distribution-right record, and separate authorized publication targets.
 * No physical asset passport or inventory position is manufactured here.
 */
export async function provisionRedGranitiStoneCore(args: {
  tx: StoneCoreTransaction;
  sourceBusinessId: string;
  distributorBusinessId: string;
  verifiedByUserId: string;
}): Promise<void> {
  const { tx, sourceBusinessId, distributorBusinessId, verifiedByUserId } = args;

  for (const material of STONE_CORE_RED_GRANITI_MATERIALS) {
    await tx.execute(sql`
      INSERT INTO stone_materials (
        slug,
        canonical_name,
        material_class,
        material_family,
        source_business_id,
        source_profile_slug,
        source_url,
        primary_image_url,
        quarry_country,
        quarry_region,
        source_status,
        source_metadata,
        updated_at
      ) VALUES (
        ${material.slug},
        ${material.canonicalName},
        ${material.materialClass},
        ${material.materialFamily},
        ${sourceBusinessId},
        ${material.sourceProfileSlug},
        ${material.sourceUrl},
        ${material.primaryImageUrl},
        ${material.quarryCountry},
        ${material.quarryRegion || null},
        'source_verified',
        ${JSON.stringify({ summary: material.summary })}::jsonb,
        NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        material_class = EXCLUDED.material_class,
        material_family = EXCLUDED.material_family,
        source_business_id = EXCLUDED.source_business_id,
        source_profile_slug = EXCLUDED.source_profile_slug,
        source_url = EXCLUDED.source_url,
        primary_image_url = EXCLUDED.primary_image_url,
        quarry_country = EXCLUDED.quarry_country,
        quarry_region = EXCLUDED.quarry_region,
        source_status = EXCLUDED.source_status,
        source_metadata = EXCLUDED.source_metadata,
        updated_at = NOW()
    `);
  }

  await tx.execute(sql`
    INSERT INTO stone_distribution_rights (
      source_business_id,
      distributor_business_id,
      right_type,
      scope,
      exclusivity,
      territory_status,
      territory_json,
      relationship_status,
      verified_by_user_id,
      evidence_type,
      metadata,
      updated_at
    ) VALUES (
      ${sourceBusinessId},
      ${distributorBusinessId},
      ${STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.rightType},
      ${STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.scope},
      ${STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.exclusivity},
      ${STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.territoryStatus},
      '{}'::jsonb,
      ${STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.relationshipStatus},
      ${verifiedByUserId},
      ${STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.evidenceType},
      ${JSON.stringify({
        sourceProfileSlug: STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.sourceProfileSlug,
        distributorProfileSlug:
          STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.distributorProfileSlug,
      })}::jsonb,
      NOW()
    )
    ON CONFLICT (source_business_id, distributor_business_id, right_type, scope)
    DO UPDATE SET
      exclusivity = EXCLUDED.exclusivity,
      territory_status = EXCLUDED.territory_status,
      territory_json = EXCLUDED.territory_json,
      relationship_status = EXCLUDED.relationship_status,
      verified_by_user_id = EXCLUDED.verified_by_user_id,
      evidence_type = EXCLUDED.evidence_type,
      metadata = EXCLUDED.metadata,
      expires_at = NULL,
      updated_at = NOW()
  `);

  for (const material of STONE_CORE_RED_GRANITI_MATERIALS) {
    for (const target of STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS) {
      const publisherBusinessId =
        target.profileSlug === STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG
          ? sourceBusinessId
          : distributorBusinessId;

      await tx.execute(sql`
        INSERT INTO stone_publications (
          material_id,
          publisher_business_id,
          profile_slug,
          channel,
          publication_role,
          visibility,
          publication_status,
          inventory_claim,
          published_at,
          metadata,
          updated_at
        )
        SELECT
          id,
          ${publisherBusinessId},
          ${target.profileSlug},
          ${target.channel},
          ${target.publicationRole},
          ${target.visibility},
          ${target.publicationStatus},
          ${target.inventoryClaim},
          NULL,
          ${JSON.stringify({ sourceProfileSlug: material.sourceProfileSlug })}::jsonb,
          NOW()
        FROM stone_materials
        WHERE slug = ${material.slug}
        ON CONFLICT (material_id, profile_slug, channel)
        DO UPDATE SET
          publisher_business_id = EXCLUDED.publisher_business_id,
          publication_role = EXCLUDED.publication_role,
          visibility = EXCLUDED.visibility,
          publication_status = EXCLUDED.publication_status,
          inventory_claim = EXCLUDED.inventory_claim,
          published_at = NULL,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `);
    }
  }
}
