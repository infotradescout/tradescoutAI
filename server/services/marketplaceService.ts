import { and, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { db } from "../db";
import { marketplaceCategories, marketplaceListings } from "@shared/schema";

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
    const filters: any[] = [eq(marketplaceListings.status, "active")];

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

    return {
      success: true,
      data: listings,
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
  try {
    const listings = await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.county, county),
          eq(marketplaceListings.state, state),
          eq(marketplaceListings.status, "active")
        )
      )
      .orderBy(desc(marketplaceListings.createdAt))
      .limit(50);

    return {
      success: true,
      data: listings,
      message: `County listings retrieved for ${county}, ${state}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get county listings",
    };
  }
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
