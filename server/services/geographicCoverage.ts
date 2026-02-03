import { db } from "../db";
import { counties, countyEntities, countyNotes } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

export type CountyCoverageStatus = "unassigned" | "partial" | "full";

export interface CountyCoverageRow {
  countyFips: string;
  countyName: string;
  stateCode: string;
  coverageStatus: CountyCoverageStatus;
  territoryManagerCount: number;
  affiliateCount: number;
  lastEntityChangeAt: string | null;
  hasNotes: boolean;
  hasOpsNote: boolean;
  hasRiskNote: boolean;
  hasPartnerNote: boolean;
  lastNoteAt: string | null;
}

export interface CountyCoverageSummary {
  ok: true;
  totalCounties: number;
  unassignedCounties: number;
  partiallyCoveredCounties: number;
  fullyCoveredCounties: number;
  verifiedCoverageRatePercent: number;
  fullCoverageNewLast30: number;
  rows: CountyCoverageRow[];
}

function computeCoverageStatus(hasTm: boolean, hasAffiliate: boolean): CountyCoverageStatus {
  if (!hasTm && !hasAffiliate) return "unassigned";
  if (hasTm && hasAffiliate) return "full";
  return "partial";
}

function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;
  const d =
    value instanceof Date
      ? value
      : new Date(typeof value === "string" || typeof value === "number" ? value : String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function getCountyCoverageSummary(): Promise<CountyCoverageSummary> {
  // Base set of counties
  let countyRows: Array<{ countyFips: string; countyName: string; stateCode: string }> = await db
    .select({
      countyFips: counties.fips,
      countyName: counties.name,
      stateCode: counties.stateCode,
    })
    .from(counties);

  if (countyRows.length === 0) {
    // Fail-soft when DB isn't seeded yet: serve the complete in-repo dataset
    // so the coverage console still shows a stable "unassigned everywhere" view.
    try {
      const { US_STATES_COUNTIES } = await import("@shared/states-counties");
      const rows: Array<{ countyFips: string; countyName: string; stateCode: string }> = [];
      for (const state of US_STATES_COUNTIES) {
        const stateCode = state.code.toUpperCase();
        for (const county of state.counties) {
          const fips = county.fipsCode.trim();
          const name = county.name.trim();
          if (!/^\d{5}$/.test(fips)) continue;
          if (!name) continue;
          rows.push({ countyFips: fips, countyName: name, stateCode });
        }
      }
      countyRows = rows;
    } catch {
      // If even the static dataset isn't available, return an empty summary.
      return {
        ok: true,
        totalCounties: 0,
        unassignedCounties: 0,
        partiallyCoveredCounties: 0,
        fullyCoveredCounties: 0,
        verifiedCoverageRatePercent: 0,
        fullCoverageNewLast30: 0,
        rows: [],
      };
    }
  }

  const totalCounties = countyRows.length;

  // Aggregate entities per county
  const entityRows = await db
    .select({
      countyFips: countyEntities.countyFips,
      territoryManagerCount: sql<number>`SUM(CASE WHEN ${countyEntities.entityType} = 'territory_manager' AND ${countyEntities.status} = 'active' THEN 1 ELSE 0 END)::int`,
      affiliateCount: sql<number>`SUM(CASE WHEN ${countyEntities.entityType} IN ('affiliate','partner') AND ${countyEntities.status} = 'active' THEN 1 ELSE 0 END)::int`,
      hasTerritoryManager: sql<boolean>`BOOL_OR(${countyEntities.entityType} = 'territory_manager' AND ${countyEntities.status} = 'active')`,
      hasAffiliateOrPartner: sql<boolean>`BOOL_OR(${countyEntities.entityType} IN ('affiliate','partner') AND ${countyEntities.status} = 'active')`,
      lastEntityChangeAt: sql<Date | null>`MAX(${countyEntities.updatedAt})`,
    })
    .from(countyEntities)
    .groupBy(countyEntities.countyFips);

  const entityByFips = new Map<string, (typeof entityRows)[number]>();
  for (const row of entityRows) {
    entityByFips.set(row.countyFips, row);
  }

  // Aggregate notes per county
  const noteRows = await db
    .select({
      countyFips: countyNotes.countyFips,
      hasNotes: sql<boolean>`COUNT(*) > 0`,
      hasOpsNote: sql<boolean>`COUNT(*) FILTER (WHERE ${countyNotes.category} = 'operations') > 0`,
      hasRiskNote: sql<boolean>`COUNT(*) FILTER (WHERE ${countyNotes.category} = 'risk') > 0`,
      hasPartnerNote: sql<boolean>`COUNT(*) FILTER (WHERE ${countyNotes.category} IN ('affiliate','partner')) > 0`,
      lastNoteAt: sql<Date | null>`MAX(${countyNotes.updatedAt})`,
    })
    .from(countyNotes)
    .groupBy(countyNotes.countyFips);

  const notesByFips = new Map<string, (typeof noteRows)[number]>();
  for (const row of noteRows) {
    notesByFips.set(row.countyFips, row);
  }

  const rows: CountyCoverageRow[] = [];

  let unassignedCount = 0;
  let partialCount = 0;
  let fullCount = 0;
  let fullCoverageNewLast30 = 0;

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const county of countyRows) {
    const entity = entityByFips.get(county.countyFips);
    const notes = notesByFips.get(county.countyFips);

    const hasTerritoryManager = Boolean(entity?.hasTerritoryManager);
    const hasAffiliateOrPartner = Boolean(entity?.hasAffiliateOrPartner);

    const coverageStatus = computeCoverageStatus(hasTerritoryManager, hasAffiliateOrPartner);

    if (coverageStatus === "unassigned") unassignedCount += 1;
    if (coverageStatus === "partial") partialCount += 1;
    if (coverageStatus === "full") {
      fullCount += 1;

      const rawLastChange = entity?.lastEntityChangeAt;
      if (rawLastChange) {
        const d = rawLastChange instanceof Date ? rawLastChange : new Date(String(rawLastChange));
        const lastMs = d.getTime();
        if (!Number.isNaN(lastMs) && now - lastMs <= THIRTY_DAYS_MS) {
          fullCoverageNewLast30 += 1;
        }
      }
    }

    rows.push({
      countyFips: county.countyFips,
      countyName: county.countyName,
      stateCode: county.stateCode,
      coverageStatus,
      territoryManagerCount: Number(entity?.territoryManagerCount || 0),
      affiliateCount: Number(entity?.affiliateCount || 0),
      lastEntityChangeAt: toIsoOrNull(entity?.lastEntityChangeAt),
      hasNotes: Boolean(notes?.hasNotes),
      hasOpsNote: Boolean(notes?.hasOpsNote),
      hasRiskNote: Boolean(notes?.hasRiskNote),
      hasPartnerNote: Boolean(notes?.hasPartnerNote),
      lastNoteAt: toIsoOrNull(notes?.lastNoteAt),
    });
  }

  const verifiedCoverageRatePercent = totalCounties > 0 ? (fullCount / totalCounties) * 100 : 0;

  return {
    ok: true,
    totalCounties,
    unassignedCounties: unassignedCount,
    partiallyCoveredCounties: partialCount,
    fullyCoveredCounties: fullCount,
    verifiedCoverageRatePercent,
    fullCoverageNewLast30,
    rows,
  };
}

export async function getCoverageForCounty(countyFips: string): Promise<CountyCoverageRow | null> {
  const fips = String(countyFips || "").trim();
  if (!/^\d{5}$/.test(fips)) return null;

  let [county] = await db
    .select({
      countyFips: counties.fips,
      countyName: counties.name,
      stateCode: counties.stateCode,
    })
    .from(counties)
    .where(eq(counties.fips, fips))
    .limit(1);

  if (!county) {
    // Fail-soft: if the DB hasn't been fully seeded yet, still serve a
    // stable response for county pages using the static in-repo dataset.
    try {
      const { getCountyByFips } = await import("@shared/states-counties");
      const staticCounty = getCountyByFips(fips);
      if (!staticCounty) return null;
      county = {
        countyFips: fips,
        countyName: staticCounty.name,
        stateCode: staticCounty.state.toUpperCase(),
      };
    } catch {
      return null;
    }
  }

  const [entity] = await db
    .select({
      countyFips: countyEntities.countyFips,
      territoryManagerCount: sql<number>`SUM(CASE WHEN ${countyEntities.entityType} = 'territory_manager' AND ${countyEntities.status} = 'active' THEN 1 ELSE 0 END)::int`,
      affiliateCount: sql<number>`SUM(CASE WHEN ${countyEntities.entityType} IN ('affiliate','partner') AND ${countyEntities.status} = 'active' THEN 1 ELSE 0 END)::int`,
      hasTerritoryManager: sql<boolean>`BOOL_OR(${countyEntities.entityType} = 'territory_manager' AND ${countyEntities.status} = 'active')`,
      hasAffiliateOrPartner: sql<boolean>`BOOL_OR(${countyEntities.entityType} IN ('affiliate','partner') AND ${countyEntities.status} = 'active')`,
      lastEntityChangeAt: sql<Date | null>`MAX(${countyEntities.updatedAt})`,
    })
    .from(countyEntities)
    .where(eq(countyEntities.countyFips, fips))
    .groupBy(countyEntities.countyFips)
    .limit(1);

  const [notes] = await db
    .select({
      countyFips: countyNotes.countyFips,
      hasNotes: sql<boolean>`COUNT(*) > 0`,
      hasOpsNote: sql<boolean>`COUNT(*) FILTER (WHERE ${countyNotes.category} = 'operations') > 0`,
      hasRiskNote: sql<boolean>`COUNT(*) FILTER (WHERE ${countyNotes.category} = 'risk') > 0`,
      hasPartnerNote: sql<boolean>`COUNT(*) FILTER (WHERE ${countyNotes.category} IN ('affiliate','partner')) > 0`,
      lastNoteAt: sql<Date | null>`MAX(${countyNotes.updatedAt})`,
    })
    .from(countyNotes)
    .where(eq(countyNotes.countyFips, fips))
    .groupBy(countyNotes.countyFips)
    .limit(1);

  const hasTerritoryManager = Boolean(entity?.hasTerritoryManager);
  const hasAffiliateOrPartner = Boolean(entity?.hasAffiliateOrPartner);
  const coverageStatus = computeCoverageStatus(hasTerritoryManager, hasAffiliateOrPartner);

  return {
    countyFips: county.countyFips,
    countyName: county.countyName,
    stateCode: county.stateCode,
    coverageStatus,
    territoryManagerCount: Number(entity?.territoryManagerCount || 0),
    affiliateCount: Number(entity?.affiliateCount || 0),
    lastEntityChangeAt: toIsoOrNull(entity?.lastEntityChangeAt),
    hasNotes: Boolean(notes?.hasNotes),
    hasOpsNote: Boolean(notes?.hasOpsNote),
    hasRiskNote: Boolean(notes?.hasRiskNote),
    hasPartnerNote: Boolean(notes?.hasPartnerNote),
    lastNoteAt: toIsoOrNull(notes?.lastNoteAt),
  };
}
