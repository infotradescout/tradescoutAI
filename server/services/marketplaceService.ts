import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { marketplaceCategories, marketplaceListings } from "@shared/schema";
import { filterStoneDiscovery, stoneDiscoveryContext } from "./exchangeStoneDiscovery";

export interface ListingSearchParams {
  query?: string;
  category?: string;
  county?: string;
  state?: string;
  maxPrice?: number;
  minPrice?: number;
  limit?: number;
}

export async function searchMarketplaceListings(params: ListingSearchParams) {
  try {
    const filters: any[] = [eq(marketplaceListings.status, "active"),
      sql`${marketplaceListings.id} NOT LIKE 'tradescout-stone-%' AND COALESCE(${marketplaceListings.specifications}->>'commerceChannel', '') <> 'tradescout_stone_retail'`];

    if (params.query?.trim()) {
      filters.push(ilike(marketplaceListings.title, `%${params.query.trim()}%`));
    }
    if (params.county?.trim()) {
      filters.push(eq(marketplaceListings.county, params.county.trim()));
    }
    if (params.state?.trim()) {
      filters.push(eq(marketplaceListings.state, params.state.trim()));
    }
    if (Number.isFinite(params.minPrice)) {
      filters.push(gte(marketplaceListings.price, String(params.minPrice)));
    }
    if (Number.isFinite(params.maxPrice)) {
      filters.push(lte(marketplaceListings.price, String(params.maxPrice)));
    }

    let categoryId: string | null = null;
    if (params.category?.trim()) {
      const [category] = await db
        .select({ id: marketplaceCategories.id })
        .from(marketplaceCategories)
        .where(ilike(marketplaceCategories.name, params.category.trim()))
        .limit(1);
      categoryId = category?.id || null;
      if (categoryId) {
        filters.push(eq(marketplaceListings.categoryId, categoryId));
      }
    }

    const listings = await db
      .select()
      .from(marketplaceListings)
      .where(and(...filters) as any)
      .orderBy(desc(marketplaceListings.createdAt))
      .limit(Math.min(Math.max(Number(params.limit || 20), 1), 100));
    const context = stoneDiscoveryContext();
    const retail = context?.audience.allowed ? filterStoneDiscovery(context.items, {
      q: params.query, categoryId: categoryId || params.category,
      minPrice: params.minPrice, maxPrice: params.maxPrice,
    }) : [];
    const time = (row: any) => { const value = row.createdAt ? new Date(row.createdAt).getTime() : 0; return Number.isFinite(value) ? value : 0; };
    const data = [...listings, ...retail].sort((a, b) => time(b) - time(a) || String(a.id).localeCompare(String(b.id)))
      .slice(0, Math.min(Math.max(Number(params.limit || 20), 1), 100));

    return {
      success: true,
      data,
      categoryId,
      message: "Marketplace listings retrieved",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search marketplace",
    };
  }
}

export async function getMarketplaceForCounty(county: string, state: string) {
  const result = await searchMarketplaceListings({ county, state, limit: 50 });
  return result.success ? { ...result, message: `County listings retrieved for ${county}, ${state}` } : result;
}

export async function createMarketplaceListing(
  userId: string | number,
  title: string,
  description: string,
  price: number,
  category: string,
  county: string,
  state: string
) {
  try {
    if (!userId || !title || !description || !price || !category || !county || !state) {
      return {
        success: false,
        error: "Missing required fields",
      };
    }

    const [categoryRow] = await db
      .select({ id: marketplaceCategories.id })
      .from(marketplaceCategories)
      .where(ilike(marketplaceCategories.name, category.trim()))
      .limit(1);

    if (!categoryRow?.id) {
      return {
        success: false,
        error: "Invalid category",
      };
    }

    const [created] = await db
      .insert(marketplaceListings)
      .values({
        sellerId: String(userId),
        categoryId: categoryRow.id,
        title: title.trim(),
        description: description.trim(),
        price: String(price),
        county: county.trim(),
        state: state.trim(),
        condition: "good",
        status: "active",
      } as any)
      .returning();

    return {
      success: true,
      data: created,
      message: "Marketplace listing created",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create listing",
    };
  }
}

export async function getUserMarketplaceListings(userId: string | number) {
  try {
    if (!userId) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    const listings = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.sellerId, String(userId)))
      .orderBy(desc(marketplaceListings.createdAt))
      .limit(100);

    return {
      success: true,
      data: listings,
      message: "User listings retrieved",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get user listings",
    };
  }
}
