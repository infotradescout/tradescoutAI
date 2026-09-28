import { and, desc, eq, exists, gte, lte, or, sql } from "drizzle-orm";
import { communityPosts, workRequests } from "../../shared/schema";
import { db } from "../db";

export async function listRecentScoutCountyPosts(countyFips: string, now: Date, topic?: string) {
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  // A phrase match is applied before LIMIT, so an unrelated newer post cannot
  // hide a relevant published post. Parameters are literal text, not ILIKE wildcards.
  const titleMatch = topic
    ? sql<boolean>`strpos(lower(coalesce(${communityPosts.title}, '')), lower(${topic})) > 0`
    : null;
  const contentMatch = topic
    ? sql<boolean>`strpos(lower(${communityPosts.content}), lower(${topic})) > 0`
    : null;
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
        lte(communityPosts.createdAt, now),
        ...(titleMatch && contentMatch ? [or(titleMatch, contentMatch)] : [])
      )
    )
    .orderBy(
      ...(titleMatch ? [desc(titleMatch)] : []),
      desc(communityPosts.createdAt),
      desc(communityPosts.id)
    )
    .limit(10);
}
