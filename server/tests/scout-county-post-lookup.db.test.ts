import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { communityPosts, users, workRequests } from "../../shared/schema";
import { db } from "../db";
import { listRecentScoutCountyPosts } from "../scout/scoutCountyPostLookup";

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb("Scout county post lookup", () => {
  const suffix = randomUUID().slice(0, 8);
  const userId = `scout-post-${suffix}`;
  const newestPostId = `scout-post-new-${suffix}`;
  const olderPostId = `scout-post-old-${suffix}`;
  const hiddenPostId = `scout-post-hidden-${suffix}`;
  const unpublishedPostId = `scout-post-draft-${suffix}`;
  const otherCountyPostId = `scout-post-other-${suffix}`;
  const countyFips = "99998";
  const now = new Date("2026-09-23T18:00:00.000Z");
  const requestIds = Array.from({ length: 10 }, (_, index) => `scout-wr-${suffix}-${index}`);

  beforeAll(async () => {
    await db.insert(users).values({ id: userId, email: `${userId}@example.test` });
    await db.insert(communityPosts).values([
      {
        id: newestPostId,
        authorId: userId,
        title: "Newest county post",
        content: "Request-linked post",
        scope: "county",
        countyFips,
        isPublished: true,
        isHidden: false,
        createdAt: new Date("2026-09-23T17:00:00.000Z"),
      },
      {
        id: olderPostId,
        authorId: userId,
        title: "Second county post",
        content: "Independent post",
        scope: "county",
        countyFips,
        isPublished: true,
        isHidden: false,
        createdAt: new Date("2026-09-23T16:00:00.000Z"),
      },
      {
        id: hiddenPostId,
        authorId: userId,
        content: "Hidden county post",
        scope: "county",
        countyFips,
        isPublished: true,
        isHidden: true,
        createdAt: new Date("2026-09-23T17:30:00.000Z"),
      },
      {
        id: unpublishedPostId,
        authorId: userId,
        content: "Unpublished county post",
        scope: "county",
        countyFips,
        isPublished: false,
        isHidden: false,
        createdAt: new Date("2026-09-23T17:30:00.000Z"),
      },
      {
        id: otherCountyPostId,
        authorId: userId,
        content: "Published elsewhere",
        scope: "county",
        countyFips: "99997",
        isPublished: true,
        isHidden: false,
        createdAt: new Date("2026-09-23T17:30:00.000Z"),
      },
    ]);
    await db.insert(workRequests).values(
      requestIds.map((id) => ({
        id,
        createdByUserId: userId,
        title: "Linked request",
        description: "Synthetic Scout lookup fixture",
        source: "community" as const,
        sourceRefId: newestPostId,
      }))
    );
  });

  afterAll(async () => {
    await db.delete(workRequests).where(inArray(workRequests.id, requestIds));
    await db
      .delete(communityPosts)
      .where(
        inArray(communityPosts.id, [
          newestPostId,
          olderPostId,
          hiddenPostId,
          unpublishedPostId,
          otherCountyPostId,
        ])
      );
    await db.delete(users).where(eq(users.id, userId));
  });

  it("limits distinct published county posts before checking linked requests", async () => {
    const posts = await listRecentScoutCountyPosts(countyFips, now);

    expect(posts.map((post) => post.id)).toEqual([newestPostId, olderPostId]);
    expect(posts.map((post) => post.hasWorkRequest)).toEqual([true, false]);
  });
});
