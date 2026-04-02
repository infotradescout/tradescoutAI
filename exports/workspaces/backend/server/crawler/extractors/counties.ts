import { db } from "../.././db";

/**
 * Extract county data for caching
 */
export async function extractCounties() {
  try {
    const counties = await db.query.counties.findMany({
      limit: 5000,
    });

    const safeCounties = counties.map((c: any) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      stateCode: c.stateCode,
      fips: c.fips,
      population: c.population,
      description: c.description,
    }));

    return safeCounties;
  } catch (error) {
    console.error("Error extracting counties:", error);
    return [];
  }
}
