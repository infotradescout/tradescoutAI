import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { db } from "../../server/db";
import { businesses, businessCounties, counties, listingImportStaging } from "../../shared/schema";
import {
  buildImportedPublicProfileFields,
  buildTargetingImportExtras,
  mergeOnlyMissingProfileFields,
  readImportPayloadValue,
} from "./business-profile-fields";
import { normalizePhone, normalizeWebsite, parseArgs, slugify } from "./utils";

type StageRow = typeof listingImportStaging.$inferSelect;

dotenv.config();

type MergePreflight = {
  pendingRows: number;
  missingCountyFips: number;
  missingCountyRecords: number;
  duplicateKeyGroups: number;
  duplicateExtraRows: number;
};

function toInt(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function coerceLicenseStatus(input: string): string {
  const v = String(input || "")
    .trim()
    .toLowerCase();
  if (!v) return "";
  if (["approved", "active", "verified", "valid", "good"].includes(v)) return "approved";
  if (["pending", "in_review", "review", "submitted"].includes(v)) return "pending";
  if (["rejected", "denied", "invalid"].includes(v)) return "rejected";
  if (["expired", "inactive"].includes(v)) return "expired";
  return v.slice(0, 32);
}

function buildImportExtras(
  row: StageRow,
  defaults: { licenseStatusDefault?: string; licenseSource?: string }
) {
  const licenseNumber =
    readImportPayloadValue(row, ["license_number", "license_no", "license", "licenseid"]) ||
    readImportPayloadValue(row, ["license_num", "licensenumber"]);
  const jurisdiction =
    readImportPayloadValue(row, ["license_state", "license_jurisdiction", "license_state_code"]) ||
    String(row.stateCode || "").trim();
  const statusFromPayload = readImportPayloadValue(row, [
    "license_status",
    "license_verified_status",
  ]);
  // Only apply a default status when we have a license number; otherwise we'd be asserting verification
  // for rows that might not even have licensing data.
  const statusRaw = statusFromPayload || (licenseNumber ? defaults.licenseStatusDefault || "" : "");
  const licenseStatus = coerceLicenseStatus(statusRaw);
  const verifiedAt =
    readImportPayloadValue(row, ["license_verified_at", "license_verified_date", "verified_at"]) ||
    readImportPayloadValue(row, ["license_checked_at", "checked_at"]);
  const expiresAt = readImportPayloadValue(row, [
    "license_expires_at",
    "license_expiration",
    "expires_at",
  ]);

  const out: Record<string, string> = {};
  if (licenseNumber) out.license_number = licenseNumber.slice(0, 120);
  if (jurisdiction) out.license_jurisdiction = jurisdiction.slice(0, 40);
  if (licenseStatus && (licenseNumber || statusFromPayload))
    out.license_status = licenseStatus.slice(0, 32);
  if (verifiedAt) out.license_verified_at = verifiedAt.slice(0, 40);
  if (expiresAt) out.license_expires_at = expiresAt.slice(0, 40);
  if (defaults.licenseSource) out.license_source = String(defaults.licenseSource).slice(0, 64);

  // Maps-scraper / directory enrichment (do not treat as verification)
  const mapsFullAddress = readImportPayloadValue(row, ["fulladdress", "full_address", "address"]);
  const mapsStreet = readImportPayloadValue(row, ["street"]);
  const mapsMunicipality = readImportPayloadValue(row, ["municipality"]);
  const mapsCategories = readImportPayloadValue(row, ["categories", "category"]);
  const mapsReviewCount = readImportPayloadValue(row, ["review_count"]);
  const mapsAverageRating = readImportPayloadValue(row, ["average_rating"]);
  const mapsReviewUrl = readImportPayloadValue(row, ["review_url"]);
  const mapsUrl = readImportPayloadValue(row, ["google_maps_url"]);
  const mapsFeaturedImage = readImportPayloadValue(row, ["featured_image"]);

  if (mapsFullAddress) out.gmb_full_address = mapsFullAddress.slice(0, 300);
  if (mapsStreet) out.gmb_street = mapsStreet.slice(0, 220);
  if (mapsMunicipality) out.gmb_municipality = mapsMunicipality.slice(0, 220);
  if (mapsCategories) out.gmb_categories = mapsCategories.slice(0, 500);
  if (mapsReviewCount) out.gmb_review_count = mapsReviewCount.slice(0, 40);
  if (mapsAverageRating) out.gmb_average_rating = mapsAverageRating.slice(0, 40);
  if (mapsReviewUrl) out.gmb_review_url = mapsReviewUrl.slice(0, 500);
  if (mapsUrl) out.gmb_maps_url = mapsUrl.slice(0, 500);
  if (mapsFeaturedImage) out.gmb_featured_image = mapsFeaturedImage.slice(0, 500);

  for (const [key, value] of Object.entries(buildTargetingImportExtras(row))) {
    if (!out[key] && value) out[key] = value;
  }

  return Object.keys(out).length ? out : null;
}

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

async function getMergePreflight(batchId: string): Promise<MergePreflight> {
  const rows = await db.execute(sql`
    with pending as (
      select *
      from listing_import_staging
      where batch_id = ${batchId}
        and status = 'pending'
    ),
    duplicate_keys as (
      select dedupe_key, count(*) as dup_count
      from pending
      group by dedupe_key
      having count(*) > 1
    )
    select
      (select count(*) from pending)::int as pending_rows,
      (select count(*) from pending where county_fips is null)::int as missing_county_fips,
      (
        select count(*)
        from pending p
        left join counties c on c.fips = p.county_fips
        where p.county_fips is not null
          and c.id is null
      )::int as missing_county_records,
      (select count(*) from duplicate_keys)::int as duplicate_key_groups,
      coalesce((select sum(dup_count - 1) from duplicate_keys), 0)::int as duplicate_extra_rows
  `);

  const row = rows.rows[0] || {};
  return {
    pendingRows: toInt((row as any).pending_rows),
    missingCountyFips: toInt((row as any).missing_county_fips),
    missingCountyRecords: toInt((row as any).missing_county_records),
    duplicateKeyGroups: toInt((row as any).duplicate_key_groups),
    duplicateExtraRows: toInt((row as any).duplicate_extra_rows),
  };
}

async function findExistingBusiness(row: StageRow): Promise<any | null> {
  const stateFilter =
    row.stateCode && String(row.stateCode).trim()
      ? sql`exists (
          select 1
          from business_counties bc
          join counties co on co.id = bc.county_id
          where bc.business_id = ${businesses.id}
            and co.state_code = ${row.stateCode}
        )`
      : sql`true`;

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
          stateFilter,
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
          stateFilter,
          countyFilter,
          sql`regexp_replace(coalesce(${businesses.profileData} ->> 'phone', ''), '\\D', '', 'g') = ${normalizedPhone}`
        )
      )
      .limit(1);
    if (byPhone[0]) return byPhone[0];
  }

  // Normalized name matching (fallback). We normalize businesses.name on the fly to avoid
  // duplicate listings when punctuation/casing differs between uploads.
  const normalizedName = String(row.normalizedName || "").trim();
  if (normalizedName) {
    const byNormalizedName = await db
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
          stateFilter,
          countyFilter,
          sql`btrim(regexp_replace(regexp_replace(lower(${businesses.name}), '[^a-z0-9]+', ' ', 'g'), '\\s+', ' ', 'g')) = ${normalizedName}`
        )
      )
      .limit(1);
    if (byNormalizedName[0]) return byNormalizedName[0];
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
    .where(and(stateFilter, countyFilter, sql`lower(${businesses.name}) = ${row.normalizedName}`))
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
  const businessType = String(args.businessType || "other")
    .trim()
    .toLowerCase();
  const roleContext = String(args.roleContext || "business_owner").trim();
  const status = String(args.status || "draft")
    .trim()
    .toLowerCase();
  const licenseStatusDefault = String(args.licenseStatus || "").trim();
  const licenseSource = String(args.licenseSource || "").trim();
  const allowMissingCounty = String(args.allowMissingCounty || "false").toLowerCase() === "true";
  const preflightOnly = String(args.preflightOnly || "false").toLowerCase() === "true";
  const expectedPendingRaw = args.expectedPending
    ? Number.parseInt(String(args.expectedPending), 10)
    : null;
  const expectedPending =
    expectedPendingRaw != null && Number.isFinite(expectedPendingRaw) ? expectedPendingRaw : null;

  const preflight = await getMergePreflight(batchId);

  if (preflightOnly) {
    console.log(
      JSON.stringify(
        {
          batchId,
          preflight,
          dryRun,
          allowMissingCounty,
        },
        null,
        2
      )
    );
    return;
  }

  if (expectedPending != null && preflight.pendingRows !== expectedPending) {
    throw new Error(
      `Pending row count mismatch for ${batchId}: expected ${expectedPending}, found ${preflight.pendingRows}`
    );
  }

  if (
    !dryRun &&
    !allowMissingCounty &&
    (preflight.missingCountyFips > 0 || preflight.missingCountyRecords > 0)
  ) {
    throw new Error(
      [
        `Unsafe merge blocked for ${batchId}: county assignment is incomplete.`,
        `missingCountyFips=${preflight.missingCountyFips}`,
        `missingCountyRecords=${preflight.missingCountyRecords}`,
        "Resolve county routing first, or pass --allowMissingCounty=true only for a documented temporary exception.",
      ].join(" ")
    );
  }

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
    preflight,
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
      const importedExtras = buildImportExtras(row, { licenseStatusDefault, licenseSource });
      const primaryCategory =
        Array.isArray(row.tradeCategories) && row.tradeCategories.length
          ? String(row.tradeCategories[0] || "").trim()
          : String(readImportPayloadValue(row, ["categories", "category"]) || "")
              .split(",")[0]
              ?.trim();
      const importedPublicFields = buildImportedPublicProfileFields(row);

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
        const nextProfile = mergeOnlyMissingProfileFields(
          existingProfile,
          importedPublicFields
        ) as Record<string, any>;

        if (!nextProfile.phone && row.phone) nextProfile.phone = row.phone;
        if (!nextProfile.email && row.email) nextProfile.email = row.email;
        if (!nextProfile.website && row.website) nextProfile.website = row.website;
        if (!nextProfile.category && primaryCategory) nextProfile.category = primaryCategory;
        if (
          !nextProfile.services &&
          Array.isArray(row.tradeCategories) &&
          row.tradeCategories.length
        ) {
          nextProfile.services = row.tradeCategories;
        }

        if (importedExtras && typeof importedExtras === "object") {
          const nextExtras: Record<string, string> =
            nextProfile.importExtras && typeof nextProfile.importExtras === "object"
              ? { ...(nextProfile.importExtras as any) }
              : {};
          for (const [k, v] of Object.entries(importedExtras)) {
            if (!nextExtras[k] && v) nextExtras[k] = String(v);
          }
          if (Object.keys(nextExtras).length) nextProfile.importExtras = nextExtras;
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
        const profileExtras = importedExtras ? { importExtras: importedExtras } : {};
        const inserted = await db
          .insert(businesses)
          .values({
            name: row.name,
            slug: nextSlug,
            type: businessType as any,
            ownerUserId: null,
            roleContext: roleContext as any,
            claimStatus: "unclaimed",
            sources: [sourceLabel],
            profileData: {
              ...importedPublicFields,
              category: primaryCategory || undefined,
              phone: row.phone || undefined,
              email: row.email || undefined,
              website: row.website || undefined,
              services:
                Array.isArray(row.tradeCategories) && row.tradeCategories.length
                  ? row.tradeCategories
                  : undefined,
              ...profileExtras,
            },
            status: status as any,
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
