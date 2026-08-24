/* eslint-disable @typescript-eslint/no-explicit-any -- The repository exports its Drizzle database boundary as any. */
import { sql } from "drizzle-orm";
import {
  STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT,
  STONE_CORE_RED_GRANITI_MATERIALS,
  STONE_CORE_RED_GRANITI_PUBLICATION_TARGETS,
  STONE_CORE_RED_GRANITI_SOURCE_PROFILE_SLUG,
} from "@shared/stoneCore";
import { pool } from "../db";

const STONE_CORE_REQUIRED_TABLES = [
  "stone_materials",
  "stone_asset_passports",
  "stone_inventory_positions",
  "stone_publications",
] as const;

let verificationPromise: Promise<void> | null = null;

export async function verifyStoneCoreSchema(
  databasePool: Pick<typeof pool, "query"> = pool
): Promise<void> {
  const verify = () =>
    databasePool
      .query(
        `SELECT required.table_name
           FROM unnest($1::text[]) AS required(table_name)
          WHERE to_regclass('public.' || required.table_name) IS NULL`,
        [[...STONE_CORE_REQUIRED_TABLES]]
      )
      .then((result) => {
        if (result.rows.length > 0) {
          throw new Error(
            `Stone Core migrations are required: ${result.rows.map((row) => row.table_name).join(", ")}`
          );
        }
      })
      .then(() => undefined);
  if (databasePool !== pool) {
    await verify();
    return;
  }
  if (!verificationPromise) {
    verificationPromise = verify().catch((error) => {
      verificationPromise = null;
      throw error;
    });
  }
  return verificationPromise;
}

/** Backward-compatible verifier; schema creation belongs to migrations/0116. */
export const ensureStoneCoreTables = verifyStoneCoreSchema;

type StoneCoreTransaction = any;

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
        ${material.quarryRegion},
        'source_verified',
        ${JSON.stringify({ summary: material.summary })}::jsonb,
        NOW()
      )
      ON CONFLICT (source_business_id, slug) DO UPDATE SET
        canonical_name = EXCLUDED.canonical_name,
        material_class = EXCLUDED.material_class,
        material_family = EXCLUDED.material_family,
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
        distributorProfileSlug: STONE_CORE_RED_GRANITI_DISTRIBUTION_RIGHT.distributorProfileSlug,
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
          AND source_business_id = ${sourceBusinessId}
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
