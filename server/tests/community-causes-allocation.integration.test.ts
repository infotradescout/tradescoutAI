import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { communityCauses, communityCauseVotes, profiles, users } from "@shared/schema";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const shouldRunIntegration = process.env.RUN_INTEGRATION_TESTS === "true";
const describeDb = hasTestDb && shouldRunIntegration ? describe : describe.skip;

describeDb("community causes allocation integration", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ownerUserId = `test-cause-owner-${runId}`;
  const voterIds = [1, 2, 3].map((index) => `test-cause-voter-${index}-${runId}`);
  const profileId = `test-cause-profile-${runId}`;
  const causeIds = [1, 2, 3, 4].map((index) => `test-cause-${index}-${runId}`);

  async function cleanupFixtures() {
    await db.delete(communityCauseVotes).where(inArray(communityCauseVotes.causeId, causeIds));
    await db.delete(communityCauses).where(inArray(communityCauses.id, causeIds));
    await db.delete(profiles).where(eq(profiles.id, profileId));
    await db.delete(users).where(inArray(users.id, [ownerUserId, ...voterIds]));
  }

  beforeAll(async () => {
    await cleanupFixtures();

    await db.insert(users).values([
      {
        id: ownerUserId,
        email: `test-cause-owner-${runId}@example.com`,
        firstName: "Cause",
        lastName: "Owner",
      } as any,
      ...voterIds.map(
        (userId, index) =>
          ({
            id: userId,
            email: `test-cause-voter-${index + 1}-${runId}@example.com`,
            firstName: "Cause",
            lastName: `Voter${index + 1}`,
          }) as any
      ),
    ]);

    await db.insert(profiles).values({
      id: profileId,
      ownerUserId,
      roleContext: "homeowner",
      slug: `test-cause-profile-${runId}`,
      displayName: "Test Cause Profile",
      status: "published",
    } as any);

    await db.insert(communityCauses).values([
      {
        id: causeIds[0],
        profileId,
        title: "Cause A",
        description: "Cause A",
        status: "open",
      } as any,
      {
        id: causeIds[1],
        profileId,
        title: "Cause B",
        description: "Cause B",
        status: "open",
      } as any,
      {
        id: causeIds[2],
        profileId,
        title: "Cause C",
        description: "Cause C",
        status: "open",
      } as any,
      {
        id: causeIds[3],
        profileId,
        title: "Cause D",
        description: "Cause D",
        status: "open",
      } as any,
    ]);

    await db.insert(communityCauseVotes).values([
      {
        causeId: causeIds[0],
        userId: voterIds[0],
      } as any,
      {
        causeId: causeIds[1],
        userId: voterIds[1],
      } as any,
      {
        causeId: causeIds[2],
        userId: voterIds[2],
      } as any,
    ]);
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it("returns allocation shares summing to exactly 100.00", async () => {
    const causes = await storage.listCommunityCausesByProfile(profileId);

    expect(causes).toHaveLength(4);

    const totalShare = Number(
      causes.reduce((sum, cause) => sum + Number(cause.allocationShare || 0), 0).toFixed(2)
    );
    expect(totalShare).toBe(100);

    const seededCauses = causes.filter((cause) =>
      [causeIds[0], causeIds[1], causeIds[2]].includes(cause.id)
    );
    const unvotedCause = causes.find((cause) => cause.id === causeIds[3]);

    for (const cause of seededCauses) {
      expect(cause.voteCount).toBe(1);
      expect(Number(cause.weightedVoteTotal)).toBeGreaterThan(0);
      expect(cause.allocationShare).toBeGreaterThan(0);
    }

    expect(unvotedCause).toBeTruthy();
    expect(unvotedCause?.voteCount).toBe(0);
    expect(Number(unvotedCause?.weightedVoteTotal || 0)).toBe(0);
    expect(Number(unvotedCause?.allocationShare || 0)).toBe(0);
  });

  it("keeps duplicate vote submissions idempotent for the same user/cause", async () => {
    const beforeRows = await db
      .select({ id: communityCauseVotes.id })
      .from(communityCauseVotes)
      .where(eq(communityCauseVotes.causeId, causeIds[3]));

    const first = await storage.voteForCommunityCause(voterIds[0], causeIds[3]);
    const second = await storage.voteForCommunityCause(voterIds[0], causeIds[3]);

    const afterRows = await db
      .select({ id: communityCauseVotes.id })
      .from(communityCauseVotes)
      .where(eq(communityCauseVotes.causeId, causeIds[3]));

    expect(second.vote.id).toBe(first.vote.id);
    expect(second.voteCount).toBe(first.voteCount);
    expect(second.weightedVoteTotal).toBe(first.weightedVoteTotal);
    expect(second.allocationShare).toBe(first.allocationShare);
    expect(second.voteWeight).toBe(first.voteWeight);
    expect(afterRows).toHaveLength(beforeRows.length + 1);
  });

  it("keeps concurrent duplicate vote submissions idempotent", async () => {
    const beforeRows = await db
      .select({ id: communityCauseVotes.id })
      .from(communityCauseVotes)
      .where(
        and(
          eq(communityCauseVotes.causeId, causeIds[3]),
          eq(communityCauseVotes.userId, voterIds[1])
        )
      );

    const results = await Promise.all(
      Array.from({ length: 5 }).map(() => storage.voteForCommunityCause(voterIds[1], causeIds[3]))
    );

    const afterRows = await db
      .select({ id: communityCauseVotes.id })
      .from(communityCauseVotes)
      .where(
        and(
          eq(communityCauseVotes.causeId, causeIds[3]),
          eq(communityCauseVotes.userId, voterIds[1])
        )
      );

    const uniqueVoteIds = new Set(results.map((result) => result.vote.id));

    expect(uniqueVoteIds.size).toBe(1);
    expect(afterRows).toHaveLength(beforeRows.length + 1);
  });
});
