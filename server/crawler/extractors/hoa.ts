import { db } from "../../../src/db/drizzle-mock";
import { homeownerAssociations } from "@shared/schema";

/**
 * Extract HOA information for caching
 */
export async function extractHOA() {
  try {
    // Use homeownerAssociations table for HOA data
    const hoaRows = await db.select().from(homeownerAssociations).limit(1000);
    const safeHOA = hoaRows.map((hoa: any) => ({
      id: hoa.id,
      name: hoa.name,
      address: hoa.address,
      city: hoa.city,
      state: hoa.state,
      countyFips: hoa.countyFips,
      zipCode: hoa.zipCode,
      establishedYear: hoa.establishedYear,
      // add more fields as needed
      createdAt: hoa.createdAt,
    }));
    return safeHOA;
  } catch (error) {
    console.error("Error extracting HOA:", error);
    return [];
  }
}
