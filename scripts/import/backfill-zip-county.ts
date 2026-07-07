import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "../../server/db";
import { businesses, businessCounties, counties, listingImportStaging } from "../../shared/schema";
import { parseArgs, parseCsv, getFirstValue } from "./utils";

function buildZipCountyLookup(): Map<string, string> {
  const crosswalkPath = path.resolve(process.cwd(), "artifacts/import/zcta_county_rel_2020.txt");
  const raw = fs.readFileSync(crosswalkPath, "utf8");
  const lines = raw.split("\n");
  const header = lines[0].split("|");
  const zipIdx = header.indexOf("GEOID_ZCTA5_20");
  const countyIdx = header.indexOf("GEOID_COUNTY_20");
  const areaIdx = header.indexOf("AREALAND_PART");

  const best = new Map<string, { fips: string; area: number }>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split("|");
    const zip = cols[zipIdx]?.trim();
    const fips = cols[countyIdx]?.trim();
    const area = Number.parseInt(cols[areaIdx] || "0", 10) || 0;
    if (!zip || !/^\d{5}$/.test(zip) || !fips || !/^\d{5}$/.test(fips)) continue;
    const existing = best.get(zip);
    if (!existing || area > existing.area) {
      best.set(zip, { fips, area });
    }
  }

  const lookup = new Map<string, string>();
  for (const [zip, { fips }] of best) lookup.set(zip, fips);
  return lookup;
}

function buildSourceIdToZipMap(): Map<string, string> {
  const absolutePath = path.resolve(
    process.cwd(),
    "artifacts/import/master_seed_2026_07_05_all.csv"
  );
  const raw = fs.readFileSync(absolutePath, "utf8");
  const records = parseCsv(raw, ",");
  const map = new Map<string, string>();
  for (const record of records) {
    const sourceId = getFirstValue(record, ["seed_id", "source_id"]);
    const zip = getFirstValue(record, ["zip"]).trim();
    if (sourceId && zip && /^\d{5}/.test(zip)) {
      map.set(sourceId, zip.slice(0, 5));
    }
  }
  return map;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const batchId = String(args.batch || "").trim();
  if (!batchId) throw new Error("Missing --batch=<batch_id>");
  const dryRun = String(args.dryRun || "false").toLowerCase() === "true";
  const limitRaw = Number.parseInt(String(args.limit || "5000"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 20000)) : 5000;

  const zipCountyLookup = buildZipCountyLookup();
  const sourceIdToZip = buildSourceIdToZipMap();

  const rows = await db
    .select({
      id: listingImportStaging.id,
      externalId: listingImportStaging.externalId,
      mergedBusinessId: listingImportStaging.mergedBusinessId,
    })
    .from(listingImportStaging)
    .where(
      and(
        eq(listingImportStaging.batchId, batchId),
        eq(listingImportStaging.status, "merged"),
        isNull(listingImportStaging.countyFips)
      )
    )
    .limit(limit);

  const summary = {
    batchId,
    scanned: rows.length,
    resolved: 0,
    noZip: 0,
    zipNotInCrosswalk: 0,
    noBusinessId: 0,
    alreadyLinked: 0,
    dryRun,
  };

  // Sentinel written to listing_import_staging.county_fips for rows we attempted but
  // could not resolve, so re-running this script doesn't rescan them forever (there is
  // no separate "attempted" flag on this table).
  const UNRESOLVED_SENTINEL = "99999";

  const markAttempted = async (rowId: string, fips: string) => {
    if (dryRun) return;
    await db
      .update(listingImportStaging)
      .set({ countyFips: fips, updatedAt: new Date() } as any)
      .where(eq(listingImportStaging.id, rowId));
  };

  for (const row of rows) {
    if (!row.mergedBusinessId) {
      summary.noBusinessId++;
      await markAttempted(row.id, UNRESOLVED_SENTINEL);
      continue;
    }
    const zip = row.externalId ? sourceIdToZip.get(row.externalId) : undefined;
    if (!zip) {
      summary.noZip++;
      await markAttempted(row.id, UNRESOLVED_SENTINEL);
      continue;
    }
    const fips = zipCountyLookup.get(zip);
    if (!fips) {
      summary.zipNotInCrosswalk++;
      await markAttempted(row.id, UNRESOLVED_SENTINEL);
      continue;
    }

    const [county] = await db
      .select({ id: counties.id, fips: counties.fips, name: counties.name })
      .from(counties)
      .where(eq(counties.fips, fips))
      .limit(1);
    if (!county?.id) {
      summary.zipNotInCrosswalk++;
      await markAttempted(row.id, UNRESOLVED_SENTINEL);
      continue;
    }

    if (!dryRun) {
      const inserted = await db
        .insert(businessCounties)
        .values({ businessId: row.mergedBusinessId, countyId: county.id } as any)
        .onConflictDoNothing()
        .returning({ businessId: businessCounties.businessId });

      if (inserted.length === 0) {
        summary.alreadyLinked++;
      } else {
        summary.resolved++;
        const [biz] = await db
          .select({ profileData: businesses.profileData })
          .from(businesses)
          .where(eq(businesses.id, row.mergedBusinessId))
          .limit(1);
        const existingProfile: any =
          biz?.profileData && typeof biz.profileData === "object" ? biz.profileData : {};
        const existingExtras: any =
          existingProfile.importExtras && typeof existingProfile.importExtras === "object"
            ? { ...existingProfile.importExtras }
            : {};
        existingExtras.county_fips = county.fips;
        existingExtras.county_name = county.name;
        existingExtras.county_source = "zip_crosswalk";
        await db
          .update(businesses)
          .set({
            profileData: { ...existingProfile, importExtras: existingExtras },
            updatedAt: new Date(),
          } as any)
          .where(eq(businesses.id, row.mergedBusinessId));
      }
      await markAttempted(row.id, county.fips);
    } else {
      summary.resolved++;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[backfill-zip-county] failed:", error);
  process.exit(1);
});
