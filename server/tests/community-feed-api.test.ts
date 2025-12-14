import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import { communityPosts, users } from "@shared/schema";
import { storage } from "../storage";
import { inArray } from "drizzle-orm";

// Simple API-level test for community post scoping logic

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb("community feed scoping", () => {
  const countyAFips = "00101";
  const countyBFips = "00202";
  const stateCode = "TX";

  beforeAll(async () => {
    // Clear any existing test posts and users for our fake counties
    await db
      .delete(communityPosts)
      .where(inArray(communityPosts.countyFips, [countyAFips, countyBFips]));

    await db
      .delete(users)
      .where(inArray(users.id, ["test-user-a", "test-user-b"]));

    // Seed minimal users to satisfy FK constraints
    await db.insert(users).values({
      id: "test-user-a",
      email: "test-a@example.com",
      firstName: "Test",
      lastName: "A",
      state: stateCode,
      county: "Test County A",
    } as any);

    await db.insert(users).values({
      id: "test-user-b",
      email: "test-b@example.com",
      firstName: "Test",
      lastName: "B",
      state: stateCode,
      county: "Test County B",
    } as any);

    // Seed one post in County A and one in County B
    await db.insert(communityPosts).values({
      authorId: "test-user-a",
      content: "Hello from County A",
      stateCode,
      countyFips: countyAFips,
      scope: "county",
      category: "general",
    });

    await db.insert(communityPosts).values({
      authorId: "test-user-b",
      content: "Hello from County B",
      stateCode,
      countyFips: countyBFips,
      scope: "county",
      category: "general",
    });
  });

  it("returns only posts for the requested county", async () => {
    const postsForA = await storage.getCommunityPosts({
      scope: "county",
      stateCode,
      countyFips: countyAFips,
      limit: 10,
      offset: 0,
    });

    expect(postsForA.length).toBeGreaterThan(0);
    expect(postsForA.every((p) => p.location === countyAFips)).toBe(true);

    const postsForB = await storage.getCommunityPosts({
      scope: "county",
      stateCode,
      countyFips: countyBFips,
      limit: 10,
      offset: 0,
    });

    expect(postsForB.length).toBeGreaterThan(0);
    expect(postsForB.every((p) => p.location === countyBFips)).toBe(true);
  });
});
