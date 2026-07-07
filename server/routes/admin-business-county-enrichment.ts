import type { Express, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { isAdmin, isAuthenticated } from "../auth";
import { businesses, businessCounties, counties } from "@shared/schema";

function parseImportAddress(
  profileData: any
): { address: string; stateCode?: string; zip?: string } | null {
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
  const zip = String(extras.zip_code || "").trim();
  const address = full || [street, municipality, stateCode].filter(Boolean).join(", ");
  if (!address) return null;
  return { address, stateCode: stateCode || undefined, zip: zip || undefined };
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

export function registerAdminBusinessCountyEnrichmentRoutes(app: Express) {
  app.post(
    "/api/admin/businesses/enrich-counties",
    isAuthenticated,
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as any;
        const dryRun = body.dryRun === true;
        const onlyUnclaimed = body.onlyUnclaimed !== false;
        const limitRaw =
          typeof body.limit === "number" ? body.limit : parseInt(String(body.limit || "100"), 10);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

        const rowsResult = (await db.execute(sql`
          select
            b.id,
            b.name,
            b.owner_user_id as "ownerUserId",
            b.claim_status as "claimStatus",
            b.status,
            b.profile_data as "profileData"
          from businesses b
          left join business_counties bc on bc.business_id = b.id
          where bc.id is null
            and b.status <> 'suspended'
            ${onlyUnclaimed ? sql`and b.owner_user_id is null and b.claim_status = 'unclaimed'` : sql``}
          order by b.updated_at desc
          limit ${limit}
        `)) as any;

        const candidates = Array.isArray(rowsResult?.rows) ? rowsResult.rows : [];
        const summary = {
          dryRun,
          onlyUnclaimed,
          scanned: candidates.length,
          enriched: 0,
          skipped: 0,
          failed: 0,
          notFound: 0,
        };
        const details: any[] = [];

        for (const cand of candidates) {
          const parsed = parseImportAddress(cand.profileData);
          if (!parsed?.address) {
            summary.skipped++;
            details.push({
              id: cand.id,
              name: cand.name,
              status: "skipped",
              reason: "missing_address",
            });
            continue;
          }

          const geocoded = await fetchCountyFips(parsed.address);
          if (!geocoded) {
            summary.notFound++;
            details.push({
              id: cand.id,
              name: cand.name,
              status: "not_found",
              address: parsed.address,
            });
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
            details.push({
              id: cand.id,
              name: cand.name,
              status: "not_found",
              countyFips: geocoded.countyFips,
            });
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
            if (!existingExtras.state_code) existingExtras.state_code = county.stateCode;

            await db
              .update(businesses)
              .set({
                profileData: { ...existingProfile, importExtras: existingExtras },
                updatedAt: new Date(),
              } as any)
              .where(eq(businesses.id, cand.id));
          }

          summary.enriched++;
          details.push({
            id: cand.id,
            name: cand.name,
            status: dryRun ? "dry_run" : "enriched",
            countyFips: county.fips,
            countyName: county.name,
            stateCode: county.stateCode,
          });

          await new Promise((resolve) => setTimeout(resolve, 150));
        }

        return res.json({ summary, details: details.slice(0, 50) });
      } catch (error: any) {
        console.error("Error enriching business counties:", error);
        return res.status(500).json({
          message: "Failed to enrich counties",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );
}
