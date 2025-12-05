import { db } from "../../db";

/**
 * Extract HOA information for caching
 */
export async function extractHOA() {
  try {
    // Query HOA/associations from your system
    // This assumes you have a way to identify HOA-type businesses
    const hoaBusinesses = await db.query.businesses.findMany({
      where: (table, { like }) => like(table.businessType, "%HOA%"),
      limit: 1000,
    });

    const safeHOA = hoaBusinesses.map((hoa: any) => ({
      id: hoa.id,
      name: hoa.businessName,
      businessType: hoa.businessType,
      description: hoa.description,
      city: hoa.city,
      state: hoa.state,
      county: hoa.county,
      verified: hoa.verified,
      contactEmail: hoa.contactEmail,
      phone: hoa.phone,
      createdAt: hoa.createdAt,
    }));

    return safeHOA;
  } catch (error) {
    console.error("Error extracting HOA:", error);
    return [];
  }
}
