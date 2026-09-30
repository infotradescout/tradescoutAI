import { and, desc, eq, exists, gte, lte } from "drizzle-orm";
import { communityPosts, workRequests } from "../../shared/schema";
import { db } from "../db";

export async function listRecentScoutCountyPosts(countyFips: string, now: Date) {
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return db
    .select({
      id: communityPosts.id,
      title: communityPosts.title,
      content: communityPosts.content,
      createdAt: communityPosts.createdAt,
      hasWorkRequest: exists(
        db
          .select({ id: workRequests.id })
          .from(workRequests)
          .where(
            and(
              eq(workRequests.source, "community"),
              eq(workRequests.sourceRefId, communityPosts.id)
            )
          )
          .limit(1)
      ),
    })
    .from(communityPosts)
    .where(
      and(
        eq(communityPosts.isPublished, true),
        eq(communityPosts.isHidden, false),
        eq(communityPosts.scope, "county"),
        eq(communityPosts.countyFips, countyFips),
        gte(communityPosts.createdAt, weekStart),
        lte(communityPosts.createdAt, now)
      )
    )
    .orderBy(desc(communityPosts.createdAt), desc(communityPosts.id))
    .limit(10);
}
