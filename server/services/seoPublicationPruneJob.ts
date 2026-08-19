import { sql } from "drizzle-orm";
import {
  BUSINESS_IDENTITY_VERIFICATION_SCOPE,
  FULLY_VERIFIED_BUSINESS_PERCENT,
  FULLY_VERIFIED_BUSINESS_STATUS,
  LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE,
} from "@shared/businessDiscoveryAuthority";
import { db } from "../db";
import { getPublicationRules, invalidatePublicationRulesCache } from "../publicationRules";
import { invalidateDirectorySitemapCaches } from "../routes/profiles";

export type SeoPublicationPruneResult = {
  businessesDeactivated: number;
  activitiesExpired: number;
};

let cachedHasPublicDiscoveryEnabledColumn: boolean | null = null;
let loggedMissingPublicDiscoveryEnabledColumn = false;

async function hasPublicDiscoveryEnabledColumn(): Promise<boolean> {
  if (cachedHasPublicDiscoveryEnabledColumn !== null) return cachedHasPublicDiscoveryEnabledColumn;
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'public_discovery_enabled'
      ) as exists;
    `);
    const exists = Boolean((result as any)?.rows?.[0]?.exists);
    cachedHasPublicDiscoveryEnabledColumn = exists;
    return exists;
  } catch {
    cachedHasPublicDiscoveryEnabledColumn = false;
    return false;
  }
}

export async function runSeoPublicationPruneJob(): Promise<SeoPublicationPruneResult> {
  const rules = await getPublicationRules();

  const staleUnclaimedDays = Math.max(1, Math.floor(rules.listingStaleDaysUnclaimed));
  const staleClaimedDays = Math.max(1, Math.floor(rules.listingStaleDaysClaimedUnverified));
  const staleVerifiedDays = Math.max(1, Math.floor(rules.listingStaleDaysVerified));

  const now = new Date();

  // Deactivate stale listings (soft) so sitemaps and lists can prune by a single indexed flag.
  // This is a discovery-only toggle; operational/routing data remains untouched.
  let businessesDeactivated = 0;
  if (await hasPublicDiscoveryEnabledColumn()) {
    const deactivated = await db.execute(sql`
      with candidates as (
        select
          b.id,
          b.owner_user_id,
          lower(coalesce(b.claim_status::text, '')) as claim_status,
          b.updated_at,
          exists (
            select 1
            from business_counties bc
            where bc.business_id = b.id
          ) as has_fixed_county,
          (
            (
              lower(coalesce(u.verification_status::text, '')) = 'approved'
              and coalesce(u.address_verified, false) = true
            )
            or
            (
              lower(
                coalesce(
                  b.profile_data->'importExtras'->>'business_verification',
                  ''
                )
              ) = ${FULLY_VERIFIED_BUSINESS_STATUS}
              and coalesce(
                b.profile_data->'importExtras'->>'verification_percent',
                ''
              ) = ${String(FULLY_VERIFIED_BUSINESS_PERCENT)}
              and coalesce(
                b.profile_data->'importExtras'->'verification_scope',
                '[]'::jsonb
              ) ? ${BUSINESS_IDENTITY_VERIFICATION_SCOPE}
              and coalesce(b.sources, '[]'::jsonb) ? coalesce(
                b.profile_data->'importExtras'->>'verification_source',
                ''
              )
            )
          ) as publication_verified,
          lower(
            coalesce(
              b.profile_data->'importExtras'->>'service_area_mode',
              ''
            )
          ) = ${LOCATION_CONFIRMED_PER_REQUEST_SERVICE_AREA_MODE}
            as location_confirmed_per_request
        from businesses b
        left join users u on u.id = b.owner_user_id
        where b.status = 'active'
          and b.public_discovery_enabled = true
      ),
      stale as (
        select id
        from candidates
        where
          (
            not has_fixed_county
            and not (publication_verified and location_confirmed_per_request)
          )
          or
          (
            publication_verified
            and updated_at < (now() - (${staleVerifiedDays}::int * interval '1 day'))
          )
          or
          (
            not publication_verified
            and (owner_user_id is null or claim_status = 'unclaimed')
            and updated_at < (now() - (${staleUnclaimedDays}::int * interval '1 day'))
          )
          or
          (
            not publication_verified
            and owner_user_id is not null
            and claim_status <> 'unclaimed'
            and updated_at < (now() - (${staleClaimedDays}::int * interval '1 day'))
          )
      ),
      updated as (
        update businesses b
        set public_discovery_enabled = false,
            updated_at = greatest(b.updated_at, now())
        where b.id in (select id from stale)
        returning b.id
      )
      insert into ts_seo_prune_log(entity_type, entity_id, action, reason, happened_at)
        select 'business', id::text, 'deactivated', 'stale_by_publication_rules', now()
        from updated
      returning entity_id;
    `);

    businessesDeactivated = Array.isArray((deactivated as any)?.rows)
      ? (deactivated as any).rows.length
      : 0;
  } else if (!loggedMissingPublicDiscoveryEnabledColumn) {
    loggedMissingPublicDiscoveryEnabledColumn = true;
    console.error(
      "[SEO] Skipping prune job: businesses.public_discovery_enabled is missing. Run migrations to restore SEO discovery pruning."
    );
  }

  // Expire activity rows (safe public summaries only).
  const expired = await db.execute(sql`
    with updated as (
      update ts_public_activity
      set active_status = false
      where active_status = true and expires_at <= now()
      returning id
    )
    select id from updated;
  `);

  const activitiesExpired = Array.isArray((expired as any)?.rows)
    ? (expired as any).rows.length
    : 0;

  // Invalidate in-memory caches (best-effort).
  try {
    invalidatePublicationRulesCache();
  } catch {
    // ignore
  }
  try {
    invalidateDirectorySitemapCaches();
  } catch {
    // ignore
  }

  // Touch to make sure unused var doesn't lint-fail in some configs.
  void now;

  return { businessesDeactivated, activitiesExpired };
}
