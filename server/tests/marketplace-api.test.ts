import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import {
  users,
  marketplaceCategories,
  marketplaceListings,
} from "@shared/schema";
import { storage } from "../storage";
import { and, eq, inArray } from "drizzle-orm";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb("marketplace storage helpers", () => {
  const stateCode = "TX";
  const countyX = "Test County X";
  const countyY = "Test County Y";

  const userXId = "marketplace-user-x";
  const userYId = "marketplace-user-y";

  let toolsCategoryId: string;
  let listingXId: string;
  let listingYId: string;

  beforeAll(async () => {
    // Clean any prior test data
    await db
      .delete(marketplaceListings)
      .where(
        and(
          inArray(marketplaceListings.county, [countyX, countyY]),
          eq(marketplaceListings.state, stateCode),
        ),
      );

    await db
      .delete(marketplaceCategories)
      .where(inArray(marketplaceCategories.name, ["Test Tools", "Test Misc"]));

    await db
      .delete(users)
      .where(inArray(users.id, [userXId, userYId]));

    // Seed users
    await db.insert(users).values({
      id: userXId,
      email: "market-x@example.com",
      firstName: "Market",
      lastName: "UserX",
      state: stateCode,
      county: countyX,
    } as any);

    await db.insert(users).values({
      id: userYId,
      email: "market-y@example.com",
      firstName: "Market",
      lastName: "UserY",
      state: stateCode,
      county: countyY,
    } as any);

    // Seed a simple category
    const [category] = await db
      .insert(marketplaceCategories)
      .values({
        name: "Test Tools",
        description: "Test category for marketplace-api tests",
        iconName: "tools",
      } as any)
      .returning();

    toolsCategoryId = category.id;

    // Seed one listing per county using storage helper
    const createdX = await (storage as any).createMarketplaceListing({
      sellerId: userXId,
      categoryId: toolsCategoryId,
      title: "County X Test Listing",
      description: "Listing seeded for county X",
      price: "100.00",
      county: countyX,
      state: stateCode,
      condition: "good",
      isLocalPickupOnly: true,
      willShip: false,
      status: "active",
    } as any);

    const createdY = await (storage as any).createMarketplaceListing({
      sellerId: userYId,
      categoryId: toolsCategoryId,
      title: "County Y Test Listing",
      description: "Listing seeded for county Y",
      price: "200.00",
      county: countyY,
      state: stateCode,
      condition: "good",
      isLocalPickupOnly: true,
      willShip: false,
      status: "active",
    } as any);

    listingXId = createdX.id;
    listingYId = createdY.id;
  });

  it("filters getMarketplaceListings by state and county", async () => {
    const listingsForX = await (storage as any).getMarketplaceListings({
      state: stateCode,
      county: countyX,
      limit: 10,
      offset: 0,
    });

    expect(listingsForX.length).toBeGreaterThan(0);
    expect(listingsForX.every((l: any) => l.county === countyX)).toBe(true);

    const listingsForY = await (storage as any).getMarketplaceListings({
      state: stateCode,
      county: countyY,
      limit: 10,
      offset: 0,
    });

    expect(listingsForY.length).toBeGreaterThan(0);
    expect(listingsForY.every((l: any) => l.county === countyY)).toBe(true);
  });

  it("createMarketplaceListing persists and is discoverable via getMarketplaceListings", async () => {
    const title = "API Created Listing";

    const created = await (storage as any).createMarketplaceListing({
      sellerId: userXId,
      categoryId: toolsCategoryId,
      title,
      description: "Created from marketplace-api test",
      price: "150.00",
      county: countyX,
      state: stateCode,
      condition: "good",
      isLocalPickupOnly: true,
      willShip: false,
      status: "active",
    } as any);

    expect(created.id).toBeTruthy();
    expect(created.title).toBe(title);
    expect(created.state).toBe(stateCode);
    expect(created.county).toBe(countyX);

    const listings = await (storage as any).getMarketplaceListings({
      state: stateCode,
      county: countyX,
      searchQuery: "API Created Listing",
      limit: 20,
      offset: 0,
    });

    const match = listings.find((l: any) => l.id === created.id);
    expect(match).toBeTruthy();
  });
});
