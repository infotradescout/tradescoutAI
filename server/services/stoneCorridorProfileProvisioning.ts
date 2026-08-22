import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { businessCounties, businesses, counties, listingImportStaging } from "@shared/schema";
import {
  buildImportedPublicProfileFields,
  buildTargetingImportExtras,
  mergeOnlyMissingProfileFields,
} from "../../scripts/import/business-profile-fields";
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeWebsite,
  parseCsv,
  parseTradeCategories,
  slugify,
} from "../../scripts/import/utils";
import { db } from "../db";

export const STONE_CORRIDOR_RELEASE_ID = "stone_corridor_baton_rouge_panama_city_20260822";
export const STONE_CORRIDOR_SOURCE = "official_web_stone_corridor_20260822";
export const STONE_CORRIDOR_PUBLIC_TRADE_SLUG = "masonry-contractor";
export const STONE_CORRIDOR_DATASET_PATH =
  "scripts/import/datasets/stone-corridor-baton-rouge-to-panama-city-2026-08-22.csv";

export type StoneCorridorReleasePhase = "draft" | "active" | "rollback";

type DatasetRow = Record<string, string>;

type ExistingBusinessCandidate = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string | null;
  claimStatus: string;
  profileData: unknown;
  publicDiscoveryEnabled: boolean;
  sources: unknown;
  status: string;
};

type ReleaseDecision = {
  externalId: string;
  name: string;
  slug: string | null;
  action: string;
  previousStatus: string | null;
  nextStatus: string | null;
};

export type StoneCorridorReleaseSummary = {
  releaseId: string;
  phase: StoneCorridorReleasePhase;
  rowCount: number;
  created: number;
  updatedUnclaimed: number;
  claimedPreserved: number;
  suspendedPreserved: number;
  activated: number;
  rolledBack: number;
  skipped: number;
  decisions: ReleaseDecision[];
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asSources(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
}

function readBooleanMarker(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

export function resolveStoneCorridorReleasePhase(value: unknown): StoneCorridorReleasePhase {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "active") return "active";
  if (normalized === "rollback") return "rollback";
  return "draft";
}

export function selectStoneCorridorBusinessMatch(
  candidates: ExistingBusinessCandidate[],
  row: DatasetRow
): ExistingBusinessCandidate | null {
  const externalId = String(row.external_id || "").trim();
  const website = normalizeWebsite(row.website || "");
  const phone = normalizePhone(row.phone || "");
  const name = normalizeName(row.business_name || "");
  const ordered = [...candidates].sort((left, right) => {
    const leftClaimed = Boolean(left.ownerUserId) || left.claimStatus === "claimed";
    const rightClaimed = Boolean(right.ownerUserId) || right.claimStatus === "claimed";
    return Number(rightClaimed) - Number(leftClaimed);
  });

  return (
    ordered.find((candidate) => {
      const extras = asRecord(asRecord(candidate.profileData).importExtras);
      return externalId && String(extras.external_id || "") === externalId;
    }) ||
    ordered.find((candidate) => {
      const profile = asRecord(candidate.profileData);
      return website && normalizeWebsite(profile.website || "") === website;
    }) ||
    ordered.find((candidate) => {
      const profile = asRecord(candidate.profileData);
      return phone && normalizePhone(profile.phone || "") === phone;
    }) ||
    ordered.find((candidate) => name && normalizeName(candidate.name) === name) ||
    null
  );
}

export function resolveStoneCorridorVisibility(params: {
  phase: StoneCorridorReleasePhase;
  currentStatus: string;
  currentPublicDiscoveryEnabled: boolean;
  importExtras: Record<string, unknown>;
}): {
  status: "draft" | "active" | "suspended";
  publicDiscoveryEnabled: boolean;
  markActivated: boolean;
} {
  const currentStatus = ["draft", "active", "suspended"].includes(params.currentStatus)
    ? (params.currentStatus as "draft" | "active" | "suspended")
    : "draft";
  const alreadyActivated = Boolean(String(params.importExtras.release_activated_at || "").trim());

  if (currentStatus === "suspended") {
    return {
      status: "suspended",
      publicDiscoveryEnabled: params.currentPublicDiscoveryEnabled,
      markActivated: false,
    };
  }

  if (params.phase === "active" && !alreadyActivated) {
    return {
      status: "active",
      publicDiscoveryEnabled: true,
      markActivated: true,
    };
  }

  if (params.phase === "rollback") {
    const previousStatus = String(params.importExtras.release_previous_status || "draft");
    const restoredStatus =
      previousStatus === "active"
        ? "active"
        : previousStatus === "suspended"
          ? "suspended"
          : "draft";
    return {
      status: restoredStatus,
      publicDiscoveryEnabled: readBooleanMarker(
        params.importExtras.release_previous_public_discovery_enabled,
        restoredStatus === "active"
      ),
      markActivated: false,
    };
  }

  return {
    status: currentStatus,
    publicDiscoveryEnabled: params.currentPublicDiscoveryEnabled,
    markActivated: false,
  };
}

function loadDatasetRows(): DatasetRow[] {
  const absolutePath = path.resolve(process.cwd(), STONE_CORRIDOR_DATASET_PATH);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Stone corridor dataset is missing: ${STONE_CORRIDOR_DATASET_PATH}`);
  }
  const rows = parseCsv(fs.readFileSync(absolutePath, "utf8"), ",");
  if (rows.length !== 51) {
    throw new Error(`Stone corridor release expected 51 rows and found ${rows.length}`);
  }

  const externalIds = new Set<string>();
  for (const row of rows) {
    const externalId = String(row.external_id || "").trim();
    if (!externalId || externalIds.has(externalId)) {
      throw new Error(`Stone corridor release contains a missing or duplicate external_id`);
    }
    if (!/^\d{5}$/.test(String(row.county_fips || ""))) {
      throw new Error(`Stone corridor row ${externalId} has invalid county routing`);
    }
    externalIds.add(externalId);
  }
  return rows;
}

function buildProfileSeed(row: DatasetRow, previous?: ExistingBusinessCandidate) {
  const publicFields = buildImportedPublicProfileFields({
    rawPayload: row,
    stateCode: row.state_code,
    countyFips: row.county_fips,
    countyName: row.county_name,
  });
  const tradeCategories = parseTradeCategories(row.trade_categories || "");
  const existingProfile = asRecord(previous?.profileData);
  const existingExtras = asRecord(existingProfile.importExtras);
  const targetingExtras = buildTargetingImportExtras({
    rawPayload: row,
    stateCode: row.state_code,
    countyFips: row.county_fips,
    countyName: row.county_name,
  });
  const importedExtras = {
    ...targetingExtras,
    external_id: String(row.external_id || "").trim(),
    release_id: STONE_CORRIDOR_RELEASE_ID,
    release_previous_status: previous?.status || "absent",
    release_previous_public_discovery_enabled: String(previous?.publicDiscoveryEnabled ?? false),
  };
  const nextExtras = mergeOnlyMissingProfileFields(existingExtras, importedExtras);
  const nextProfile = mergeOnlyMissingProfileFields(existingProfile, publicFields);

  // Public discovery currently requires a canonical TradeScout trade slug.
  // Masonry & Stonework is the established stone category; the researched
  // fabricator/supplier/installer roles remain intact in services/importExtras.
  if (!nextProfile.category) nextProfile.category = STONE_CORRIDOR_PUBLIC_TRADE_SLUG;
  if (!nextProfile.services && tradeCategories.length) nextProfile.services = tradeCategories;
  if (!nextProfile.website && row.website) nextProfile.website = normalizeWebsite(row.website);
  if (!nextProfile.phone && row.phone) nextProfile.phone = normalizePhone(row.phone);
  if (!nextProfile.email && row.email) nextProfile.email = normalizeEmail(row.email);
  // Imported directory facts must never bypass TradeScout's intent-gated contact flow.
  // Claimed profiles never reach this branch, and existing explicit owner/admin choices
  // are preserved because only missing flags are filled.
  if (typeof nextProfile.publicContactEnabled !== "boolean") {
    nextProfile.publicContactEnabled = false;
  }
  if (typeof nextProfile.publicWebsiteEnabled !== "boolean") {
    nextProfile.publicWebsiteEnabled = false;
  }
  if (typeof nextProfile.publicLocationEnabled !== "boolean") {
    nextProfile.publicLocationEnabled = true;
  }
  nextProfile.importExtras = nextExtras;

  return { profileData: nextProfile, importExtras: nextExtras, tradeCategories };
}

async function generateUniqueSlug(tx: any, base: string): Promise<string> {
  const baseSlug = slugify(base).slice(0, 160) || randomUUID();
  const existing = await tx
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(like(businesses.slug, `${baseSlug}%`));
  const existingSet = new Set(existing.map((row: { slug: string }) => row.slug));
  if (!existingSet.has(baseSlug)) return baseSlug;
  for (let suffix = 2; suffix <= 200; suffix++) {
    const candidate = `${baseSlug}-${suffix}`;
    if (!existingSet.has(candidate)) return candidate;
  }
  return `${baseSlug}-${randomUUID().slice(0, 8)}`;
}

export async function provisionStoneCorridorProfiles(): Promise<StoneCorridorReleaseSummary | null> {
  if (process.env.NODE_ENV !== "production") return null;

  const phase = resolveStoneCorridorReleasePhase(process.env.STONE_CORRIDOR_RELEASE_PHASE);
  const rows = loadDatasetRows();
  const summary: StoneCorridorReleaseSummary = {
    releaseId: STONE_CORRIDOR_RELEASE_ID,
    phase,
    rowCount: rows.length,
    created: 0,
    updatedUnclaimed: 0,
    claimedPreserved: 0,
    suspendedPreserved: 0,
    activated: 0,
    rolledBack: 0,
    skipped: 0,
    decisions: [],
  };

  await db.transaction(async (tx) => {
    // A Render deploy can briefly overlap instances. Serialize the exact release so
    // two production boots cannot create the same corridor location concurrently.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${STONE_CORRIDOR_RELEASE_ID}))`);
    const targetFips = Array.from(new Set(rows.map((row) => row.county_fips)));
    const countyRows = await tx
      .select({ id: counties.id, fips: counties.fips })
      .from(counties)
      .where(inArray(counties.fips, targetFips));
    const countyByFips = new Map(
      countyRows.map((county: { id: string; fips: string }) => [county.fips, county.id])
    );
    const missingFips = targetFips.filter((fips) => !countyByFips.has(fips));
    if (missingFips.length) {
      throw new Error(`Stone corridor county records are missing: ${missingFips.join(", ")}`);
    }

    for (const row of rows) {
      const externalId = String(row.external_id || "").trim();
      const countyFips = String(row.county_fips || "").trim();
      const countyId = String(countyByFips.get(countyFips));
      const normalizedWebsite = normalizeWebsite(row.website || "");
      const normalizedPhone = normalizePhone(row.phone || "");
      const normalizedBusinessName = normalizeName(row.business_name || "");
      const dedupeKey = [
        normalizedBusinessName,
        row.state_code || "_",
        countyFips,
        normalizedPhone || "_",
        normalizedWebsite || "_",
      ]
        .join("|")
        .slice(0, 255);
      const tradeCategories = parseTradeCategories(row.trade_categories || "");

      await tx
        .insert(listingImportStaging)
        .values({
          batchId: STONE_CORRIDOR_RELEASE_ID,
          source: STONE_CORRIDOR_SOURCE,
          externalId,
          name: String(row.business_name || "").slice(0, 255),
          normalizedName: normalizedBusinessName.slice(0, 255),
          phone: normalizedPhone || null,
          email: normalizeEmail(row.email || "") || null,
          website: normalizedWebsite || null,
          stateCode: String(row.state_code || "").slice(0, 2) || null,
          countyFips,
          countyName: String(row.county_name || "").slice(0, 128) || null,
          tradeCategories,
          dedupeKey,
          rawPayload: row,
          status: "pending",
        } as any)
        .onConflictDoNothing({
          target: [
            listingImportStaging.batchId,
            listingImportStaging.source,
            listingImportStaging.externalId,
          ],
        });

      const [stageRow] = await tx
        .select({ id: listingImportStaging.id })
        .from(listingImportStaging)
        .where(
          and(
            eq(listingImportStaging.batchId, STONE_CORRIDOR_RELEASE_ID),
            eq(listingImportStaging.source, STONE_CORRIDOR_SOURCE),
            eq(listingImportStaging.externalId, externalId)
          )
        )
        .limit(1);
      if (!stageRow?.id) throw new Error(`Stone corridor staging failed for ${externalId}`);

      const result = (await tx.execute(sql`
        select
          b.id,
          b.name,
          b.slug,
          b.owner_user_id as "ownerUserId",
          b.claim_status as "claimStatus",
          b.profile_data as "profileData",
          b.public_discovery_enabled as "publicDiscoveryEnabled",
          b.sources,
          b.status::text as status
        from businesses b
        join business_counties bc on bc.business_id = b.id
        join counties c on c.id = bc.county_id
        where c.fips = ${countyFips}
        order by
          case when b.owner_user_id is not null or b.claim_status = 'claimed' then 0 else 1 end,
          b.created_at asc
      `)) as any;
      const candidates: ExistingBusinessCandidate[] = Array.isArray(result?.rows)
        ? result.rows
        : [];
      const existing = selectStoneCorridorBusinessMatch(candidates, row);

      if (phase === "rollback") {
        const existingProfile = asRecord(existing?.profileData);
        const existingExtras = asRecord(existingProfile.importExtras);
        const releaseOwned = existingExtras.release_id === STONE_CORRIDOR_RELEASE_ID;
        if (!existing || !releaseOwned) {
          summary.skipped++;
          summary.decisions.push({
            externalId,
            name: row.business_name,
            slug: existing?.slug || null,
            action: "rollback_not_release_owned",
            previousStatus: existing?.status || null,
            nextStatus: existing?.status || null,
          });
          continue;
        }
        const claimed = Boolean(existing.ownerUserId) || existing.claimStatus === "claimed";
        if (claimed) {
          summary.claimedPreserved++;
          summary.decisions.push({
            externalId,
            name: row.business_name,
            slug: existing.slug,
            action: "claimed_preserved",
            previousStatus: existing.status,
            nextStatus: existing.status,
          });
          continue;
        }

        const visibility = resolveStoneCorridorVisibility({
          phase,
          currentStatus: existing.status,
          currentPublicDiscoveryEnabled: existing.publicDiscoveryEnabled,
          importExtras: existingExtras,
        });
        existingProfile.importExtras = {
          ...existingExtras,
          release_rolled_back_at: new Date().toISOString(),
        };
        await tx
          .update(businesses)
          .set({
            profileData: existingProfile,
            status: visibility.status,
            publicDiscoveryEnabled: visibility.publicDiscoveryEnabled,
            updatedAt: new Date(),
          } as any)
          .where(eq(businesses.id, existing.id));
        await tx
          .update(listingImportStaging)
          .set({
            status: "merged",
            mergedBusinessId: existing.id,
            mergeNotes: `Release rollback restored status=${visibility.status}`,
            updatedAt: new Date(),
          } as any)
          .where(eq(listingImportStaging.id, stageRow.id));
        summary.rolledBack++;
        summary.decisions.push({
          externalId,
          name: row.business_name,
          slug: existing.slug,
          action: "rolled_back",
          previousStatus: existing.status,
          nextStatus: visibility.status,
        });
        continue;
      }

      if (existing) {
        const claimed = Boolean(existing.ownerUserId) || existing.claimStatus === "claimed";
        const nextSources = Array.from(
          new Set([...asSources(existing.sources), STONE_CORRIDOR_SOURCE])
        );
        if (claimed) {
          await tx
            .update(businesses)
            .set({ sources: nextSources, updatedAt: new Date() } as any)
            .where(eq(businesses.id, existing.id));
          await tx
            .update(listingImportStaging)
            .set({
              status: "merged",
              mergedBusinessId: existing.id,
              mergeNotes: "Matched claimed listing: source merged, claimed fields preserved",
              updatedAt: new Date(),
            } as any)
            .where(eq(listingImportStaging.id, stageRow.id));
          summary.claimedPreserved++;
          summary.decisions.push({
            externalId,
            name: row.business_name,
            slug: existing.slug,
            action: "claimed_preserved",
            previousStatus: existing.status,
            nextStatus: existing.status,
          });
          continue;
        }

        const seed = buildProfileSeed(row, existing);
        const visibility = resolveStoneCorridorVisibility({
          phase,
          currentStatus: existing.status,
          currentPublicDiscoveryEnabled: existing.publicDiscoveryEnabled,
          importExtras: seed.importExtras,
        });
        if (visibility.markActivated) {
          seed.profileData.importExtras = {
            ...seed.importExtras,
            release_activated_at: new Date().toISOString(),
          };
        }
        await tx
          .update(businesses)
          .set({
            profileData: seed.profileData,
            sources: nextSources,
            status: visibility.status,
            publicDiscoveryEnabled: visibility.publicDiscoveryEnabled,
            updatedAt: new Date(),
          } as any)
          .where(eq(businesses.id, existing.id));
        await tx
          .insert(businessCounties)
          .values({ businessId: existing.id, countyId } as any)
          .onConflictDoNothing();
        await tx
          .update(listingImportStaging)
          .set({
            status: "merged",
            mergedBusinessId: existing.id,
            mergeNotes:
              phase === "active"
                ? `Matched unclaimed listing: audited fields merged, status=${visibility.status}`
                : `Matched unclaimed listing: audited fields merged, status preserved as ${visibility.status}`,
            updatedAt: new Date(),
          } as any)
          .where(eq(listingImportStaging.id, stageRow.id));

        summary.updatedUnclaimed++;
        if (existing.status === "suspended") summary.suspendedPreserved++;
        if (visibility.markActivated) summary.activated++;
        summary.decisions.push({
          externalId,
          name: row.business_name,
          slug: existing.slug,
          action:
            existing.status === "suspended"
              ? "suspended_preserved"
              : visibility.markActivated
                ? "activated_unclaimed"
                : "merged_unclaimed",
          previousStatus: existing.status,
          nextStatus: visibility.status,
        });
        continue;
      }

      const seed = buildProfileSeed(row);
      const slug = await generateUniqueSlug(tx, row.business_name);
      const createdAt = new Date();
      const creationVisibility = resolveStoneCorridorVisibility({
        phase,
        currentStatus: "draft",
        currentPublicDiscoveryEnabled: false,
        importExtras: seed.importExtras,
      });
      const createActive = creationVisibility.status === "active";
      if (createActive) {
        seed.profileData.importExtras = {
          ...seed.importExtras,
          release_activated_at: createdAt.toISOString(),
        };
      }
      const [created] = await tx
        .insert(businesses)
        .values({
          name: String(row.business_name || "").slice(0, 255),
          slug,
          type: "other",
          ownerUserId: null,
          roleContext: "business_owner",
          profileData: seed.profileData,
          claimStatus: "unclaimed",
          publicDiscoveryEnabled: creationVisibility.publicDiscoveryEnabled,
          sources: [STONE_CORRIDOR_SOURCE],
          status: createActive ? "active" : "draft",
          createdAt,
          updatedAt: createdAt,
        } as any)
        .returning({ id: businesses.id, slug: businesses.slug });
      if (!created?.id)
        throw new Error(`Stone corridor business creation failed for ${externalId}`);
      await tx
        .insert(businessCounties)
        .values({ businessId: created.id, countyId } as any)
        .onConflictDoNothing();
      await tx
        .update(listingImportStaging)
        .set({
          status: "merged",
          mergedBusinessId: created.id,
          mergeNotes: createActive
            ? "Created audited unclaimed listing as active"
            : "Created audited unclaimed listing as draft",
          updatedAt: new Date(),
        } as any)
        .where(eq(listingImportStaging.id, stageRow.id));

      summary.created++;
      if (createActive) summary.activated++;
      summary.decisions.push({
        externalId,
        name: row.business_name,
        slug: created.slug,
        action: createActive ? "created_active" : "created_draft",
        previousStatus: null,
        nextStatus: createActive ? "active" : "draft",
      });
    }
  });

  console.log(`[StoneCorridorRelease] ${JSON.stringify(summary)}`);
  return summary;
}
