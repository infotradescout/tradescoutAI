import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import { communityPosts, users } from "../../shared/schema";
import { storage } from "../storage";
import { inArray } from "drizzle-orm";

// Simple API-level test for community post scoping logic

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb("community feed scoping", () => {
  const countyAFips = "00101";
  const countyBFips = "00202";
  const stateCode = "TX";
  const standardOrderingContent = "Community ordering fixture: standard post";
  const welcomeOrderingContent = "Community ordering fixture: generated welcome";

  beforeAll(async () => {
    // Clear existing posts for our fake counties. Keep the two stable fixture
    // users: deleting parent user rows from the long-lived test database fans
    // out across hundreds of foreign keys and can exceed the hook timeout.
    await db
      .delete(communityPosts)
      .where(inArray(communityPosts.countyFips, [countyAFips, countyBFips]));

    // Seed minimal users once to satisfy FK constraints, then reuse them.
    await db
      .insert(users)
      .values([
        {
          id: "test-user-a",
          email: "test-a@example.com",
          firstName: "Test",
          lastName: "A",
          state: stateCode,
          county: "Test County A",
        } as any,
        {
          id: "test-user-b",
          email: "test-b@example.com",
          firstName: "Test",
          lastName: "B",
          state: stateCode,
          county: "Test County B",
        } as any,
      ])
      .onConflictDoNothing();

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

    await db.insert(communityPosts).values([
      {
        authorId: "test-user-a",
        content: standardOrderingContent,
        stateCode,
        countyFips: countyAFips,
        scope: "county",
        category: "general",
        createdAt: new Date("2020-01-01T00:00:00.000Z"),
      },
      {
        authorId: "test-user-a",
        content: welcomeOrderingContent,
        stateCode,
        countyFips: countyAFips,
        scope: "county",
        category: "announcements",
        tags: ["new_neighbor"],
        createdAt: new Date("2021-01-01T00:00:00.000Z"),
      },
    ]);
  });

  it("returns only posts for the requested county", async () => {
    const postsForA = await storage.getCommunityPosts({
      scope: "county",
      stateCode,
      countyFips: countyAFips,
      limit: 10,
      offset: 0,
      demoteOnboardingWelcomes: false,
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

  it("demotes generated welcomes only when requested", async () => {
    const recentPosts = await storage.getCommunityPosts({
      scope: "county",
      stateCode,
      countyFips: countyAFips,
      limit: 10,
      offset: 0,
      demoteOnboardingWelcomes: false,
    });
    const demotedPosts = await storage.getCommunityPosts({
      scope: "county",
      stateCode,
      countyFips: countyAFips,
      limit: 10,
      offset: 0,
      demoteOnboardingWelcomes: true,
    });

    const recentWelcomeIndex = recentPosts.findIndex(
      (post) => post.content === welcomeOrderingContent
    );
    const recentStandardIndex = recentPosts.findIndex(
      (post) => post.content === standardOrderingContent
    );
    const demotedWelcomeIndex = demotedPosts.findIndex(
      (post) => post.content === welcomeOrderingContent
    );
    const demotedStandardIndex = demotedPosts.findIndex(
      (post) => post.content === standardOrderingContent
    );

    expect(recentWelcomeIndex).toBeGreaterThanOrEqual(0);
    expect(recentStandardIndex).toBeGreaterThanOrEqual(0);
    expect(recentWelcomeIndex).toBeLessThan(recentStandardIndex);
    expect(demotedWelcomeIndex).toBeGreaterThanOrEqual(0);
    expect(demotedStandardIndex).toBeGreaterThanOrEqual(0);
    expect(demotedStandardIndex).toBeLessThan(demotedWelcomeIndex);
  });
});
