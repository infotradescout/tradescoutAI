import dotenv from "dotenv";
dotenv.config();
import { eq, sql } from "drizzle-orm";
import { db } from "../../server/db";
import { businesses, businessCounties, counties } from "../../shared/schema";
import { parseArgs } from "./utils";

function parseImportAddress(profileData: any): { address: string; stateCode?: string } | null {
  const pd = profileData && typeof profileData === "object" ? profileData : {};
  const extras = pd.importExtras && typeof pd.importExtras === "object" ? pd.importExtras : {};
  const full = String(
    extras.gmb_full_address || extras.fulladdress || extras.full_address || extras.address || ""
  ).trim();
  const street = String(extras.gmb_street || extras.street || "").trim();
  const municipality = String(extras.gmb_municipality || extras.municipality || "").trim();
  const stateCode = String(extras.state_code || extras.license_jurisdiction || "")
    .trim()
    .toUpperCase();
  const address = full || [street, municipality, stateCode].filter(Boolean).join(", ");
  if (!address) return null;
  return { address, stateCode: stateCode || undefined };
}

async function fetchCountyFips(
  address: string
): Promise<{ countyFips: string; countyName?: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
    url.searchParams.set("address", address);
    url.searchParams.set("benchmark", "2020");
    url.searchParams.set("vintage", "2020");
    url.searchParams.set("format", "json");
    const resp = await fetch(url.toString(), { signal: controller.signal });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    const county = data?.result?.addressMatches?.[0]?.geographies?.Counties?.[0];
    const geoid = String(county?.GEOID || "").trim();
    if (!/^\d{5}$/.test(geoid)) return null;
    return {
      countyFips: geoid,
      countyName: typeof county?.NAME === "string" ? county.NAME : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const limitRaw = Number.parseInt(String(args.limit || "500"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 2000)) : 500;
  const dryRun = String(args.dryRun || "false").toLowerCase() === "true";
  const delayMs = Number.parseInt(String(args.delayMs || "150"), 10);
  const sourceFilter = String(args.source || "csv_import").trim();

  const rowsResult = (await db.execute(sql`
    select
      b.id,
      b.name,
      b.profile_data as "profileData"
    from businesses b
    left join business_counties bc on bc.business_id = b.id
    where bc.id is null
      and b.status <> 'suspended'
      and b.sources @> ${JSON.stringify([sourceFilter])}::jsonb
    order by b.created_at asc
    limit ${limit}
  `)) as any;

  const candidates = Array.isArray(rowsResult?.rows) ? rowsResult.rows : [];
  const summary = {
    scanned: candidates.length,
    enriched: 0,
    skipped: 0,
    notFound: 0,
    dryRun,
  };

  for (const cand of candidates) {
    const parsed = parseImportAddress(cand.profileData);
    if (!parsed?.address) {
      summary.skipped++;
      continue;
    }

    const geocoded = await fetchCountyFips(parsed.address);
    if (!geocoded) {
      summary.notFound++;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    const [county] = await db
      .select({
        id: counties.id,
        fips: counties.fips,
        name: counties.name,
        stateCode: counties.stateCode,
      })
      .from(counties)
      .where(eq(counties.fips, geocoded.countyFips))
      .limit(1);

    if (!county?.id) {
      summary.notFound++;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    if (!dryRun) {
      await db
        .insert(businessCounties)
        .values({ businessId: cand.id, countyId: county.id } as any)
        .onConflictDoNothing();

      const existingProfile: any =
        cand.profileData && typeof cand.profileData === "object" ? cand.profileData : {};
      const existingExtras: any =
        existingProfile.importExtras && typeof existingProfile.importExtras === "object"
          ? { ...existingProfile.importExtras }
          : {};
      if (!existingExtras.county_fips) existingExtras.county_fips = county.fips;
      if (!existingExtras.county_name) existingExtras.county_name = county.name;

      await db
        .update(businesses)
        .set({
          profileData: { ...existingProfile, importExtras: existingExtras },
          updatedAt: new Date(),
        } as any)
        .where(eq(businesses.id, cand.id));
    }

    summary.enriched++;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[enrich-business-counties] failed:", error);
  process.exit(1);
});
