import { sql } from "drizzle-orm";
import { db } from "../db";
import { getPublicationRules, invalidatePublicationRulesCache } from "../publicationRules";
import { invalidateDirectorySitemapCaches } from "../routes/profiles";

export type SeoPublicationPruneResult = {
  businessesDeactivated: number;
  activitiesExpired: number;
};

export async function runSeoPublicationPruneJob(): Promise<SeoPublicationPruneResult> {
  const rules = await getPublicationRules();

  const staleUnclaimedDays = Math.max(1, Math.floor(rules.listingStaleDaysUnclaimed));
  const staleClaimedDays = Math.max(1, Math.floor(rules.listingStaleDaysClaimedUnverified));
  const staleVerifiedDays = Math.max(1, Math.floor(rules.listingStaleDaysVerified));

  const now = new Date();

  // Deactivate stale listings (soft) so sitemaps and lists can prune by a single indexed flag.
  // This is a discovery-only toggle; operational/routing data remains untouched.
  const deactivated = await db.execute(sql`
    with stale as (
      select b.id
      from businesses b
      left join users u on u.id = b.owner_user_id
      where b.status = 'active'
        and b.public_discovery_enabled = true
        and (
          not exists (select 1 from business_counties bc where bc.business_id = b.id)
          or
          (
            (b.owner_user_id is null or lower(coalesce(b.claim_status::text, '')) = 'unclaimed')
            and b.updated_at < (now() - (${staleUnclaimedDays}::int * interval '1 day'))
          )
          or
          (
            (b.owner_user_id is not null and lower(coalesce(b.claim_status::text, '')) <> 'unclaimed')
            and not (lower(coalesce(u.verification_status::text, '')) = 'approved' and coalesce(u.address_verified, false) = true)
            and b.updated_at < (now() - (${staleClaimedDays}::int * interval '1 day'))
          )
          or
          (
            (b.owner_user_id is not null and lower(coalesce(b.claim_status::text, '')) <> 'unclaimed')
            and (lower(coalesce(u.verification_status::text, '')) = 'approved' and coalesce(u.address_verified, false) = true)
            and b.updated_at < (now() - (${staleVerifiedDays}::int * interval '1 day'))
          )
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

  const businessesDeactivated = Array.isArray((deactivated as any)?.rows)
    ? (deactivated as any).rows.length
    : 0;

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
