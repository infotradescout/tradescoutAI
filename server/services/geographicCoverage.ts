import { db } from "../db";
import { counties, countyEntities, countyNotes } from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";

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

export async function getCountyCoverageSummary(): Promise<CountyCoverageSummary> {
  // Base set of counties
  const countyRows = await db
    .select({
      countyFips: counties.fips,
      countyName: counties.name,
      stateCode: counties.stateCode,
    })
    .from(counties);

  const totalCounties = countyRows.length;

  if (totalCounties === 0) {
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
    entityByFips.set(row.countyFips as string, row);
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
    notesByFips.set(row.countyFips as string, row);
  }

  const rows: CountyCoverageRow[] = [];

  let unassignedCount = 0;
  let partialCount = 0;
  let fullCount = 0;
  let fullCoverageNewLast30 = 0;

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const county of countyRows) {
    const entity = entityByFips.get(county.countyFips as string);
    const notes = notesByFips.get(county.countyFips as string);

    const hasTerritoryManager = Boolean(entity?.hasTerritoryManager);
    const hasAffiliateOrPartner = Boolean(entity?.hasAffiliateOrPartner);

    const coverageStatus = computeCoverageStatus(hasTerritoryManager, hasAffiliateOrPartner);

    if (coverageStatus === "unassigned") unassignedCount += 1;
    if (coverageStatus === "partial") partialCount += 1;
    if (coverageStatus === "full") {
      fullCount += 1;

      const lastChange = entity?.lastEntityChangeAt as Date | null | undefined;
      if (lastChange) {
        const lastMs = lastChange.getTime();
        if (now - lastMs <= THIRTY_DAYS_MS) {
          fullCoverageNewLast30 += 1;
        }
      }
    }

    rows.push({
      countyFips: county.countyFips as string,
      countyName: county.countyName as string,
      stateCode: county.stateCode as string,
      coverageStatus,
      territoryManagerCount: Number(entity?.territoryManagerCount || 0),
      affiliateCount: Number(entity?.affiliateCount || 0),
      lastEntityChangeAt: entity?.lastEntityChangeAt ? (entity.lastEntityChangeAt as Date).toISOString() : null,
      hasNotes: Boolean(notes?.hasNotes),
      hasOpsNote: Boolean(notes?.hasOpsNote),
      hasRiskNote: Boolean(notes?.hasRiskNote),
      hasPartnerNote: Boolean(notes?.hasPartnerNote),
      lastNoteAt: notes?.lastNoteAt ? (notes.lastNoteAt as Date).toISOString() : null,
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
