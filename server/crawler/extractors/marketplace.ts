import { db } from "../.././db";
import { isStoneDiscoveryRow } from "../../services/exchangeStoneDiscovery";

/**
 * Extract active marketplace listings for caching.
 * City-restricted retail rows belong to request-scoped discovery, never this unlocalized cache.
 */
export async function extractMarketplace() {
  try {
    const listings = await db.query.marketplaceListings.findMany({
      where: (table: any, { eq }: any) => eq(table.status, "active"),
      limit: 1000,
    });
    return listings.filter((listing: any) => !isStoneDiscoveryRow(listing)).map((l: any) => ({
      id: l.id, title: l.title, description: l.description, price: l.price, priceType: l.priceType,
      condition: l.condition, category: l.categoryId, county: l.county, state: l.state, city: l.city,
      isLocalPickupOnly: l.isLocalPickupOnly, willShip: l.willShip, brand: l.brand,
      model: l.model, createdAt: l.createdAt,
    }));
  } catch (error) {
    console.error("Error extracting marketplace:", error);
    return [];
  }
}
