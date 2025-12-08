import { db } from "../../../src/db/drizzle-mock";

/**
 * Extract active marketplace listings for caching
 * Only includes public-facing data
 */
export async function extractMarketplace() {
  try {
    const listings = await db.query.marketplaceListings.findMany({
      where: (table: any, { eq }: any) => eq(table.status, "active"),
      limit: 1000,
    });

    // Strip out private/admin-only data
    const safeListings = listings.map((l: any) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      price: l.price,
      priceType: l.priceType,
      condition: l.condition,
      category: l.categoryId,
      county: l.county,
      state: l.state,
      city: l.city,
      isLocalPickupOnly: l.isLocalPickupOnly,
      willShip: l.willShip,
      brand: l.brand,
      model: l.model,
      createdAt: l.createdAt,
    }));

    return safeListings;
  } catch (error) {
    console.error("Error extracting marketplace:", error);
    return [];
  }
}
