import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../../server/db";
import { businesses, businessCounties, counties, listingImportStaging } from "../../shared/schema";
import { normalizePhone, normalizeWebsite, parseArgs, slugify } from "./utils";

type StageRow = typeof listingImportStaging.$inferSelect;

async function ensureUniqueBusinessSlug(base: string): Promise<string> {
  const baseSlug = slugify(base);
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, candidate))
      .limit(1);
    if (!existing.length) return candidate;
  }
  return `${baseSlug}-${randomUUID().slice(0, 8)}`;
}

async function findCountyId(countyFips: string | null): Promise<string | null> {
  if (!countyFips) return null;
  const rows = await db
    .select({ id: counties.id })
    .from(counties)
    .where(eq(counties.fips, countyFips))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function findExistingBusiness(row: StageRow): Promise<any | null> {
  const countyFilter = row.countyFips
    ? sql`exists (
        select 1
        from business_counties bc
        join counties co on co.id = bc.county_id
        where bc.business_id = ${businesses.id}
          and co.fips = ${row.countyFips}
      )`
    : sql`true`;

  const normalizedWebsite = normalizeWebsite(row.website || "");
  if (normalizedWebsite) {
    const byWebsite = await db
      .select({
        id: businesses.id,
        ownerUserId: businesses.ownerUserId,
        claimStatus: businesses.claimStatus,
        profileData: businesses.profileData,
        sources: businesses.sources,
      })
      .from(businesses)
      .where(
        and(
          countyFilter,
          sql`lower(coalesce(${businesses.profileData} ->> 'website', '')) = ${normalizedWebsite}`
        )
      )
      .limit(1);
    if (byWebsite[0]) return byWebsite[0];
  }

  const normalizedPhone = normalizePhone(row.phone || "");
  if (normalizedPhone) {
    const byPhone = await db
      .select({
        id: businesses.id,
        ownerUserId: businesses.ownerUserId,
        claimStatus: businesses.claimStatus,
        profileData: businesses.profileData,
        sources: businesses.sources,
      })
      .from(businesses)
      .where(
        and(
          countyFilter,
          sql`regexp_replace(coalesce(${businesses.profileData} ->> 'phone', ''), '\\D', '', 'g') = ${normalizedPhone}`
        )
      )
      .limit(1);
    if (byPhone[0]) return byPhone[0];
  }

  const byName = await db
    .select({
      id: businesses.id,
      ownerUserId: businesses.ownerUserId,
      claimStatus: businesses.claimStatus,
      profileData: businesses.profileData,
      sources: businesses.sources,
    })
    .from(businesses)
    .where(and(countyFilter, sql`lower(${businesses.name}) = ${row.normalizedName}`))
    .limit(1);

  return byName[0] || null;
}

async function mergeSourceArray(businessId: string, source: string) {
  await db.execute(sql`
    update businesses
    set sources = (
      select coalesce(jsonb_agg(distinct source_value), '[]'::jsonb)
      from (
        select jsonb_array_elements_text(coalesce(businesses.sources, '[]'::jsonb)) as source_value
        union all
        select ${source}
      ) merged_sources
    ),
    updated_at = now()
    where businesses.id = ${businessId}
  `);
}

async function markStageRow(
  rowId: string,
  status: "merged" | "skipped_duplicate" | "failed",
  mergedBusinessId: string | null,
  notes: string
) {
  await db
    .update(listingImportStaging)
    .set({
      status,
      mergedBusinessId,
      mergeNotes: notes,
      updatedAt: new Date(),
    } as any)
    .where(eq(listingImportStaging.id, rowId));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchId = String(args.batch || "").trim();
  if (!batchId) {
    throw new Error("Missing --batch=<batch_id> (from stage script output)");
  }

  const dryRun = String(args.dryRun || "false").toLowerCase() === "true";
  const limitRaw = Number.parseInt(String(args.limit || "500"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 5000)) : 500;

  const rows = await db
    .select()
    .from(listingImportStaging)
    .where(
      and(eq(listingImportStaging.batchId, batchId), eq(listingImportStaging.status, "pending"))
    )
    .limit(limit);

  const seenKeys = new Set<string>();
  const summary = {
    batchId,
    scanned: rows.length,
    created: 0,
    mergedIntoUnclaimed: 0,
    mergedIntoClaimed: 0,
    skippedDuplicates: 0,
    failed: 0,
    dryRun,
  };

  for (const row of rows) {
    try {
      if (seenKeys.has(row.dedupeKey)) {
        summary.skippedDuplicates++;
        if (!dryRun) {
          await markStageRow(
            row.id,
            "skipped_duplicate",
            null,
            "Duplicate dedupe_key within batch"
          );
        }
        continue;
      }
      seenKeys.add(row.dedupeKey);

      const existing = await findExistingBusiness(row);
      const sourceLabel = String(row.source || "csv_import");

      if (existing) {
        const isClaimed = Boolean(existing.ownerUserId) || existing.claimStatus === "claimed";
        if (!dryRun) {
          await mergeSourceArray(existing.id, sourceLabel);
        }

        if (isClaimed) {
          summary.mergedIntoClaimed++;
          if (!dryRun) {
            await markStageRow(
              row.id,
              "merged",
              existing.id,
              "Matched claimed listing: source merged, claimed fields preserved"
            );
          }
          continue;
        }

        const existingProfile = (existing.profileData || {}) as Record<string, any>;
        const nextProfile = { ...existingProfile };

        if (!nextProfile.phone && row.phone) nextProfile.phone = row.phone;
        if (!nextProfile.email && row.email) nextProfile.email = row.email;
        if (!nextProfile.website && row.website) nextProfile.website = row.website;
        if (
          !nextProfile.services &&
          Array.isArray(row.tradeCategories) &&
          row.tradeCategories.length
        ) {
          nextProfile.services = row.tradeCategories;
        }

        if (!dryRun) {
          await db
            .update(businesses)
            .set({
              profileData: nextProfile,
              updatedAt: new Date(),
            } as any)
            .where(eq(businesses.id, existing.id));
          await markStageRow(
            row.id,
            "merged",
            existing.id,
            "Matched unclaimed listing: merged only missing fields"
          );
        }
        summary.mergedIntoUnclaimed++;
        continue;
      }

      const nextSlug = await ensureUniqueBusinessSlug(row.name);
      const countyId = await findCountyId(row.countyFips || null);

      if (!dryRun) {
        const inserted = await db
          .insert(businesses)
          .values({
            name: row.name,
            slug: nextSlug,
            type: "other" as any,
            ownerUserId: null,
            roleContext: "business_owner" as any,
            claimStatus: "unclaimed",
            sources: [sourceLabel],
            profileData: {
              phone: row.phone || undefined,
              email: row.email || undefined,
              website: row.website || undefined,
              services:
                Array.isArray(row.tradeCategories) && row.tradeCategories.length
                  ? row.tradeCategories
                  : undefined,
            },
            status: "draft" as any,
          } as any)
          .returning({ id: businesses.id });

        const businessId = inserted[0]?.id;
        if (!businessId) throw new Error("Business insert failed");

        if (countyId) {
          await db
            .insert(businessCounties)
            .values({ businessId, countyId } as any)
            .onConflictDoNothing();
        }

        await markStageRow(row.id, "merged", businessId, "Created new unclaimed listing");
      }

      summary.created++;
    } catch (error: any) {
      summary.failed++;
      if (!dryRun) {
        await markStageRow(
          row.id,
          "failed",
          null,
          String(error?.message || "Merge failed").slice(0, 500)
        );
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[merge-staged-businesses] failed:", error);
  process.exit(1);
});
