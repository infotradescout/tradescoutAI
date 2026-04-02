import express from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import communityCausesRouter from "../routes/community-causes-routes";
import { communityCauses, communityCauseVotes, profiles, users } from "@shared/schema";

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const shouldRunIntegration = process.env.RUN_INTEGRATION_TESTS === "true";
const describeDb = hasTestDb && shouldRunIntegration ? describe : describe.skip;

describeDb("community causes route integration", () => {
  const ownerUserId = "route-cause-owner";
  const noVoteOwnerUserId = "route-cause-owner-novote";
  const voterIds = ["route-cause-voter-1", "route-cause-voter-2", "route-cause-voter-3"];
  const profileId = "route-cause-profile";
  const noVoteProfileId = "route-cause-profile-novote";
  const causeIds = ["route-cause-a", "route-cause-b", "route-cause-c"];
  const noVoteCauseIds = ["route-cause-novote-a", "route-cause-novote-b"];
  const orderedCreatedAt = {
    oldest: new Date("2026-01-01T00:00:00.000Z"),
    middle: new Date("2026-01-02T00:00:00.000Z"),
    newest: new Date("2026-01-03T00:00:00.000Z"),
  };

  beforeAll(async () => {
    await db
      .delete(communityCauseVotes)
      .where(inArray(communityCauseVotes.causeId, [...causeIds, ...noVoteCauseIds]));
    await db
      .delete(communityCauses)
      .where(inArray(communityCauses.id, [...causeIds, ...noVoteCauseIds]));
    await db.delete(profiles).where(inArray(profiles.id, [profileId, noVoteProfileId]));
    await db.delete(users).where(inArray(users.id, [ownerUserId, noVoteOwnerUserId, ...voterIds]));

    await db.insert(users).values([
      {
        id: ownerUserId,
        email: "route-cause-owner@example.com",
        firstName: "Route",
        lastName: "Owner",
      } as any,
      {
        id: noVoteOwnerUserId,
        email: "route-cause-owner-novote@example.com",
        firstName: "Route",
        lastName: "NoVoteOwner",
      } as any,
      ...voterIds.map(
        (userId, index) =>
          ({
            id: userId,
            email: `route-cause-voter-${index + 1}@example.com`,
            firstName: "Route",
            lastName: `Voter${index + 1}`,
          }) as any
      ),
    ]);

    await db.insert(profiles).values({
      id: profileId,
      ownerUserId,
      roleContext: "homeowner",
      slug: "route-cause-profile",
      displayName: "Route Cause Profile",
      status: "published",
    } as any);

    await db.insert(profiles).values({
      id: noVoteProfileId,
      ownerUserId: noVoteOwnerUserId,
      roleContext: "homeowner",
      slug: "route-cause-profile-novote",
      displayName: "Route Cause Profile No Vote",
      status: "published",
    } as any);

    await db.insert(communityCauses).values([
      {
        id: causeIds[0],
        profileId,
        title: "Route Cause A",
        description: "Route Cause A",
        status: "open",
        createdAt: orderedCreatedAt.oldest,
      } as any,
      {
        id: causeIds[1],
        profileId,
        title: "Route Cause B",
        description: "Route Cause B",
        status: "open",
        createdAt: orderedCreatedAt.middle,
      } as any,
      {
        id: causeIds[2],
        profileId,
        title: "Route Cause C",
        description: "Route Cause C",
        status: "open",
        createdAt: orderedCreatedAt.newest,
      } as any,
      {
        id: noVoteCauseIds[0],
        profileId: noVoteProfileId,
        title: "Route No Vote Cause A",
        description: "Route No Vote Cause A",
        status: "open",
      } as any,
      {
        id: noVoteCauseIds[1],
        profileId: noVoteProfileId,
        title: "Route No Vote Cause B",
        description: "Route No Vote Cause B",
        status: "open",
      } as any,
    ]);

    await db
      .insert(communityCauseVotes)
      .values([
        { causeId: causeIds[0], userId: voterIds[0] } as any,
        { causeId: causeIds[1], userId: voterIds[1] } as any,
        { causeId: causeIds[2], userId: voterIds[2] } as any,
      ]);
  });

  it("returns profile causes with allocation shares summing to exactly 100.00", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/community-causes", communityCausesRouter);

    const res = await request(app).get(`/api/community-causes/profile/${profileId}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);

    const totalShare = Number(
      res.body
        .reduce((sum: number, cause: any) => sum + Number(cause?.allocationShare || 0), 0)
        .toFixed(2)
    );

    expect(totalShare).toBe(100);
    for (const cause of res.body) {
      expect(Number(cause.voteCount)).toBeGreaterThanOrEqual(1);
      expect(Number(cause.weightedVoteTotal)).toBeGreaterThan(0);
      expect(Number(cause.allocationShare)).toBeGreaterThan(0);
    }
  });

  it("returns profile causes in deterministic newest-first order", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/community-causes", communityCausesRouter);

    const res = await request(app).get(`/api/community-causes/profile/${profileId}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((cause: any) => cause.id)).toEqual([causeIds[2], causeIds[1], causeIds[0]]);
  });

  it("returns zero weighted totals and zero allocation shares when no votes exist", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/community-causes", communityCausesRouter);

    const res = await request(app).get(`/api/community-causes/profile/${noVoteProfileId}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    const totalShare = Number(
      res.body
        .reduce((sum: number, cause: any) => sum + Number(cause?.allocationShare || 0), 0)
        .toFixed(2)
    );
    expect(totalShare).toBe(0);

    for (const cause of res.body) {
      expect(Number(cause.voteCount)).toBe(0);
      expect(Number(cause.weightedVoteTotal)).toBe(0);
      expect(Number(cause.allocationShare)).toBe(0);
    }
  });
});
