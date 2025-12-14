import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../db";
import { communityGroups, groupMembers, users } from "@shared/schema";
import { storage } from "../storage";
import { inArray, eq } from "drizzle-orm";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasTestDb ? describe : describe.skip;

describeDb("community groups scoping and membership", () => {
  const countyAFips = "03101";
  const countyBFips = "03202";
  const stateCode = "TX";

  const userAId = "groups-test-user-a";
  const userBId = "groups-test-user-b";

  let groupAId: string;
  let groupBId: string;

  beforeAll(async () => {
    // Clean up any prior test data
    await db
      .delete(groupMembers)
      .where(inArray(groupMembers.userId, [userAId, userBId]));

    await db
      .delete(communityGroups)
      .where(inArray(communityGroups.countyFips, [countyAFips, countyBFips]));

    await db
      .delete(users)
      .where(inArray(users.id, [userAId, userBId]));

    // Seed users
    await db.insert(users).values({
      id: userAId,
      email: "groups-a@example.com",
      firstName: "Groups",
      lastName: "A",
      state: stateCode,
      county: "Groups County A",
    } as any);

    await db.insert(users).values({
      id: userBId,
      email: "groups-b@example.com",
      firstName: "Groups",
      lastName: "B",
      state: stateCode,
      county: "Groups County B",
    } as any);

    // Seed groups for each county
    const [groupA] = await db
      .insert(communityGroups)
      .values({
        name: "County A Homeowners",
        description: "A group for County A homeowners",
        slug: "county-a-homeowners-test",
        groupType: "auto_county" as any,
        scope: "county" as any,
        stateCode,
        countyFips: countyAFips,
      })
      .returning();

    const [groupB] = await db
      .insert(communityGroups)
      .values({
        name: "County B Homeowners",
        description: "A group for County B homeowners",
        slug: "county-b-homeowners-test",
        groupType: "auto_county" as any,
        scope: "county" as any,
        stateCode,
        countyFips: countyBFips,
      })
      .returning();

    groupAId = groupA.id;
    groupBId = groupB.id;
  });

  it("returns only groups for the requested county", async () => {
    const groupsForA = await storage.getGroups({
      stateCode,
      countyFips: countyAFips,
      limit: 10,
      offset: 0,
      search: undefined,
      userId: undefined,
    });

    expect(groupsForA.length).toBeGreaterThan(0);
    expect(groupsForA.every((g) => g.countyFips === countyAFips)).toBe(true);

    const groupsForB = await storage.getGroups({
      stateCode,
      countyFips: countyBFips,
      limit: 10,
      offset: 0,
      search: undefined,
      userId: undefined,
    });

    expect(groupsForB.length).toBeGreaterThan(0);
    expect(groupsForB.every((g) => g.countyFips === countyBFips)).toBe(true);
  });

  it("joinGroup is idempotent and leaveGroup deactivates membership", async () => {
    // Ensure no prior membership
    await db
      .delete(groupMembers)
      .where(
        inArray(groupMembers.userId, [userAId])
      );

    // First join should create membership
    const firstJoin = await storage.joinGroup(userAId, groupAId);
    expect(firstJoin).toBeDefined();

    const afterFirstJoin = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.userId, userAId));
    expect(afterFirstJoin.length).toBe(1);
    expect(afterFirstJoin[0].isActive).toBe(true);

    // Second join should no-op (still one row)
    const secondJoin = await storage.joinGroup(userAId, groupAId);
    expect(secondJoin).toBeDefined();

    const afterSecondJoin = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.userId, userAId));
    expect(afterSecondJoin.length).toBe(1);

    // Leave should mark inactive
    await storage.leaveGroup(userAId, groupAId);

    const afterLeave = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.userId, userAId));

    expect(afterLeave.length).toBe(1);
    expect(afterLeave[0].isActive).toBe(false);
  });
});
