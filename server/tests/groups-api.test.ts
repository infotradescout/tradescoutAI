import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import { communityGroups, counties, groupMembers, states, users } from "@shared/schema";
import { storage } from "../storage";
import { and, eq, inArray } from "drizzle-orm";
import { createGroup, ensureCountyGroupMembershipForUser } from "../routes/groups";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasTestDb ? describe : describe.skip;
const HOOK_TIMEOUT_MS = 30_000;

describeDb("community groups scoping and membership", () => {
  const countyAFips = "03101";
  const countyBFips = "03202";
  const canonicalStateCode = "ZG";
  const canonicalCountyFips = "97301";
  const stateCode = "TX";

  const userAId = "groups-test-user-a";
  const userBId = "groups-test-user-b";
  const userCanonicalId = "groups-test-user-canonical";

  let groupAId: string;
  let groupBId: string;

  const createMockResponse = () => {
    const result: { statusCode: number; body: unknown } = { statusCode: 200, body: undefined };
    const response = {
      status(code: number) {
        result.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        result.body = payload;
        return this;
      },
    };

    return { response: response as any, result };
  };

  beforeAll(async () => {
    // Clean up any prior test data
    await db
      .delete(groupMembers)
      .where(inArray(groupMembers.userId, [userAId, userBId, userCanonicalId]));

    await db
      .delete(communityGroups)
      .where(inArray(communityGroups.countyFips, [countyAFips, countyBFips, canonicalCountyFips]));

    await db.delete(users).where(inArray(users.id, [userAId, userBId, userCanonicalId]));

    await db.delete(counties).where(eq(counties.fips, canonicalCountyFips));
    await db.delete(states).where(eq(states.code, canonicalStateCode));

    await db.insert(states).values({
      id: "groups-test-state-zg",
      name: "Groups Test State",
      code: canonicalStateCode,
    });

    await db.insert(counties).values({
      id: "groups-test-county-zg-97301",
      name: "Canon County",
      fips: canonicalCountyFips,
      stateCode: canonicalStateCode,
    });

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

    await db.insert(users).values({
      id: userCanonicalId,
      email: "groups-canonical@example.com",
      firstName: "Canon",
      lastName: "User",
      state: canonicalStateCode,
      county: "Canon County",
      stateCode: canonicalStateCode,
      countyFips: canonicalCountyFips,
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
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await db
      .delete(groupMembers)
      .where(inArray(groupMembers.userId, [userAId, userBId, userCanonicalId]));

    await db
      .delete(communityGroups)
      .where(inArray(communityGroups.countyFips, [countyAFips, countyBFips, canonicalCountyFips]));

    await db.delete(users).where(inArray(users.id, [userAId, userBId, userCanonicalId]));

    await db.delete(counties).where(eq(counties.fips, canonicalCountyFips));
    await db.delete(states).where(eq(states.code, canonicalStateCode));
  }, HOOK_TIMEOUT_MS);

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
    await db.delete(groupMembers).where(inArray(groupMembers.userId, [userAId]));

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

    const afterLeave = await db.select().from(groupMembers).where(eq(groupMembers.userId, userAId));

    expect(afterLeave.length).toBe(1);
    expect(afterLeave[0].isActive).toBe(false);
  });

  it("auto-creates the county group and active membership for canonical users", async () => {
    await db.delete(groupMembers).where(eq(groupMembers.userId, userCanonicalId));
    await db.delete(communityGroups).where(eq(communityGroups.countyFips, canonicalCountyFips));

    await ensureCountyGroupMembershipForUser(userCanonicalId);

    const countyGroups = await db
      .select()
      .from(communityGroups)
      .where(
        and(
          eq(communityGroups.countyFips, canonicalCountyFips),
          eq(communityGroups.stateCode, canonicalStateCode)
        )
      );

    expect(countyGroups).toHaveLength(1);
    expect(countyGroups[0].groupType).toBe("auto_county");
    expect(countyGroups[0].createdBy).toBeNull();

    const firstMemberships = await db
      .select()
      .from(groupMembers)
      .where(
        and(eq(groupMembers.userId, userCanonicalId), eq(groupMembers.groupId, countyGroups[0].id))
      );

    expect(firstMemberships).toHaveLength(1);
    expect(firstMemberships[0].isActive).toBe(true);

    await ensureCountyGroupMembershipForUser(userCanonicalId);

    const secondMemberships = await db
      .select()
      .from(groupMembers)
      .where(
        and(eq(groupMembers.userId, userCanonicalId), eq(groupMembers.groupId, countyGroups[0].id))
      );

    expect(secondMemberships).toHaveLength(1);
  });

  it.each([
    ["specialty_trade", "trade"],
    ["interest_based", "interest"],
    ["county_community", "neighborhood"],
  ] as const)(
    "maps UI group type %s to persisted type %s and defaults to the creator county",
    async (requestedType, expectedType) => {
      const request = {
        user: { id: userCanonicalId },
        body: {
          name: `Mapped ${requestedType}`,
          description: `Coverage for ${requestedType}`,
          type: requestedType,
          isPublic: true,
        },
      } as any;
      const { response, result } = createMockResponse();

      await createGroup(request, response);

      expect(result.statusCode).toBe(201);

      const createdGroup = result.body as any;
      expect(createdGroup.groupType).toBe(expectedType);
      expect(createdGroup.scope).toBe("county");
      expect(createdGroup.stateCode).toBe(canonicalStateCode);
      expect(createdGroup.countyFips).toBe(canonicalCountyFips);
      expect(createdGroup.createdBy).toBe(userCanonicalId);

      const ownerMembership = await db
        .select()
        .from(groupMembers)
        .where(
          and(eq(groupMembers.groupId, createdGroup.id), eq(groupMembers.userId, userCanonicalId))
        );

      expect(ownerMembership).toHaveLength(1);
      expect(ownerMembership[0].role).toBe("owner");
      expect(ownerMembership[0].isActive).toBe(true);
    }
  );
});
