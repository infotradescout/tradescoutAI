import { db } from "../db";
import { and, eq, ilike, or } from "drizzle-orm";
import { counties, countyMetrics, type County as DbCounty } from "@shared/schema";

// Use the shared County type from the Drizzle schema
export type County = DbCounty;

// ============================================================================
// COUNTY INFORMATION
// ============================================================================

export async function getCountyInfo(county: string, state: string): Promise<County | null> {
  try {
    const countyName = county.trim();
    const stateCode = state.trim();

    if (!countyName || !stateCode) return null;

    const rows = await db
      .select()
      .from(counties)
      .where(
        and(ilike(counties.name, `%${countyName}%`), ilike(counties.stateCode, `%${stateCode}%`))
      )
      .limit(1);

    return rows[0] ?? null;
  } catch (error) {
    console.error("Error getting county info:", error);
    return null;
  }
}

export async function listAllCounties(): Promise<County[]> {
  try {
    const results = await db.select().from(counties).orderBy(counties.stateCode, counties.name);

    return results;
  } catch (error) {
    console.error("Error listing all counties:", error);
    return [];
  }
}

export async function getStateCounties(state: string): Promise<County[]> {
  try {
    const stateCode = state.trim();
    if (!stateCode) return [];

    const results = await db
      .select()
      .from(counties)
      .where(ilike(counties.stateCode, `%${stateCode}%`))
      .orderBy(counties.name);

    return results;
  } catch (error) {
    console.error("Error getting state counties:", error);
    return [];
  }
}

export async function searchCounties(query: string): Promise<County[]> {
  try {
    const q = query.trim();
    if (!q) return [];

    const results = await db
      .select()
      .from(counties)
      .where(or(ilike(counties.name, `%${q}%`), ilike(counties.stateCode, `%${q}%`)))
      .limit(20);

    return results;
  } catch (error) {
    console.error("Error searching counties:", error);
    return [];
  }
}

export async function getCountyStats(
  county: string,
  state: string
): Promise<{
  population: number | null;
  area?: number;
  medianIncome?: number;
  houseCounts?: number;
  businessCounts?: number;
} | null> {
  try {
    const countyInfo = await getCountyInfo(county, state);

    if (!countyInfo) {
      return null;
    }

    const metricRows = await db
      .select({
        metricKey: countyMetrics.metricKey,
        metricValue: countyMetrics.metricValue,
      })
      .from(countyMetrics)
      .where(eq(countyMetrics.countyFips, countyInfo.fips));

    const metric = (key: string) =>
      Number(metricRows.find((row) => row.metricKey === key)?.metricValue ?? 0) || undefined;

    return {
      population: countyInfo.population ?? null,
      area: metric("land_area_sq_miles"),
      medianIncome: metric("median_household_income"),
      houseCounts: metric("housing_units"),
      businessCounts: metric("active_businesses"),
    };
  } catch (error) {
    console.error("Error getting county stats:", error);
    return null;
  }
}

export async function getCountyByFipsCode(fipsCode: string): Promise<County | null> {
  try {
    const code = fipsCode.trim();
    if (!code) return null;

    const rows = await db.select().from(counties).where(eq(counties.fips, code)).limit(1);

    return rows[0] ?? null;
  } catch (error) {
    console.error("Error getting county by FIPS code:", error);
    return null;
  }
}
