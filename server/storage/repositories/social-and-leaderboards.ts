/* eslint-disable @typescript-eslint/no-explicit-any -- Preserves legacy storage method contracts during repository extraction. */
import {
  users,
  contractors,
  recommendations,
  counties,
  communityPosts,
  postComments,
  postLikes,
  communityPostSaves,
  userFollows,
  communityGroups,
  regions,
  contractorLeaderboardStats,
  workRequests,
  type User,
  type Recommendation,
  type County,
  type Message,
  type CommunityPost,
  type InsertCommunityPost,
  type PostComment,
  type InsertPostComment,
  type CommunityGroup,
  type Region,
  type WorkRequest,
} from "@shared/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  inArray,
  like,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db";
import { MarketplaceAndHomeScoutStorageRepository } from "./marketplace-and-homescout";

export class SocialAndLeaderboardStorageRepository extends MarketplaceAndHomeScoutStorageRepository {
  // Social Features Operations
  async createCommunityPost(post: InsertCommunityPost): Promise<CommunityPost> {
    const [newPost] = await db.insert(communityPosts).values(post).returning();
    return newPost;
  }

  async getCommunityPosts(filters?: {
    scope?: typeof communityPosts.scope.enumValues extends readonly (infer T)[] ? T : string;
    stateCode?: string;
    countyFips?: string;
    category?: typeof communityPosts.category.enumValues extends readonly (infer T)[] ? T : string;
    authorId?: string;
    tag?: string;
    limit?: number;
    offset?: number;
    // Social feed tuning
    sort?: "recent" | "distance" | "recommended" | "trending";
    followingOnly?: boolean;
    excludeFollowing?: boolean;
    viewerId?: string;
    radiusMiles?: number;
    demoteOnboardingWelcomes?: boolean;
  }): Promise<
    Array<
      CommunityPost & {
        author: {
          id: string;
          name: string;
          avatar?: string | null;
          role?: string | null;
          verified: boolean;
          isPrivateProfile: boolean;
          badges?: string[] | null;
        };
        tags: string[];
        location: string;
        upvotes: number;
        downvotes: number;
        comments: number;
        pinned: boolean;
        trending: boolean;
        hasWorkRequest: boolean;
        workRequestId?: string | null;
        saved?: boolean;
      }
    >
  > {
    const scopeValues = communityPosts.scope.enumValues ?? [];
    const categoryValues = communityPosts.category.enumValues ?? [];

    const conditions = [eq(communityPosts.isPublished, true), eq(communityPosts.isHidden, false)];

    if (filters?.scope && scopeValues.includes(filters.scope as any)) {
      conditions.push(eq(communityPosts.scope, filters.scope as any));
    }
    if (filters?.stateCode) {
      conditions.push(eq(communityPosts.stateCode, filters.stateCode));
    }
    if (filters?.countyFips) {
      conditions.push(eq(communityPosts.countyFips, filters.countyFips));
    }
    if (filters?.category && categoryValues.includes(filters.category as any)) {
      conditions.push(eq(communityPosts.category, filters.category as any));
    }
    if (filters?.authorId) {
      conditions.push(eq(communityPosts.authorId, filters.authorId));
    }
    if (filters?.tag) {
      const normalizedTag = String(filters.tag || "")
        .trim()
        .replace(/^#+/, "")
        .toLowerCase();
      if (normalizedTag) {
        conditions.push(sql`${communityPosts.tags} @> ARRAY[${normalizedTag}]::text[]`);
      }
    }

    // Following / recommendations selectors
    if ((filters?.followingOnly || filters?.excludeFollowing) && filters?.viewerId) {
      const followRows = await db
        .select({ followingId: userFollows.followingId })
        .from(userFollows)
        .where(eq(userFollows.followerId, filters.viewerId));

      const followingIds = followRows
        .map((r) => r.followingId)
        .filter((id): id is string => Boolean(id));

      if (filters.followingOnly) {
        if (!followingIds.length) {
          return [];
        }
        conditions.push(inArray(communityPosts.authorId, followingIds));
      } else if (filters.excludeFollowing && followingIds.length) {
        conditions.push(notInArray(communityPosts.authorId, followingIds));
      }
    } else if (filters?.followingOnly && !filters?.viewerId) {
      // Without a viewer, "following" has no meaning; return empty deterministically.
      return [];
    }

    const sortMode: "recent" | "distance" | "recommended" | "trending" =
      (filters?.sort as any) === "recommended"
        ? "recommended"
        : (filters?.sort as any) === "trending"
          ? "trending"
          : "recent";

    const baseQuery = db
      .select({
        post: communityPosts,
        user: users,
        workRequest: workRequests,
      })
      .from(communityPosts)
      .leftJoin(users, eq(communityPosts.authorId, users.id))
      .leftJoin(
        workRequests,
        and(
          eq(workRequests.source, "community" as any),
          eq(workRequests.sourceRefId, communityPosts.id as any)
        )
      )
      .where(and(...conditions));

    const pageLimit = filters?.limit ?? 20;
    const pageOffset = filters?.offset ?? 0;
    const onboardingWelcomeRank = filters?.demoteOnboardingWelcomes
      ? sql`CASE WHEN ${communityPosts.category} = 'announcements' AND (${communityPosts.tags} @> ARRAY['welcome']::text[] OR ${communityPosts.tags} @> ARRAY['new_neighbor']::text[]) THEN 1 ELSE 0 END`
      : null;
    const onboardingWelcomeOrder = onboardingWelcomeRank ? [onboardingWelcomeRank] : [];
    const recommendedOrder = [
      ...onboardingWelcomeOrder,
      // Boost recommendation-style posts and those with attached work requests
      desc(sql`CASE WHEN ${communityPosts.category} = 'recommendation_request' THEN 1 ELSE 0 END`),
      desc(communityPosts.likeCount),
      desc(communityPosts.createdAt),
    ];
    const trendingOrder = [
      ...onboardingWelcomeOrder,
      desc(sql`${communityPosts.likeCount} + ${communityPosts.commentCount}`),
      desc(communityPosts.createdAt),
    ];
    const recentOrder = [...onboardingWelcomeOrder, desc(communityPosts.createdAt)];

    // Ordering: keep recent as baseline; "recommended" boosts high-intent, high-signal posts.
    const orderedQuery =
      sortMode === "recommended"
        ? baseQuery.orderBy(...recommendedOrder)
        : sortMode === "trending"
          ? baseQuery.orderBy(...trendingOrder)
          : baseQuery.orderBy(...recentOrder);

    type CommunityPostJoinRow = {
      post: CommunityPost;
      user: User | null;
      workRequest: WorkRequest | null;
    };

    let results: CommunityPostJoinRow[];

    try {
      results = (await orderedQuery.limit(pageLimit).offset(pageOffset)) as CommunityPostJoinRow[];
    } catch (error) {
      // Production-safe fallback: if the optional work_requests join path drifts,
      // still return posts rather than failing the entire feed with 500.
      console.warn("[CommunityPosts] Primary query failed; retrying without work_requests join", {
        error: error instanceof Error ? error.message : String(error),
      });

      const fallbackBaseQuery = db
        .select({
          post: communityPosts,
          user: users,
        })
        .from(communityPosts)
        .leftJoin(users, eq(communityPosts.authorId, users.id))
        .where(and(...conditions));

      const fallbackOrderedQuery =
        sortMode === "recommended"
          ? fallbackBaseQuery.orderBy(...recommendedOrder)
          : sortMode === "trending"
            ? fallbackBaseQuery.orderBy(...trendingOrder)
            : fallbackBaseQuery.orderBy(...recentOrder);

      const fallbackRows = await fallbackOrderedQuery.limit(pageLimit).offset(pageOffset);
      results = fallbackRows.map((row: { post: CommunityPost; user: User | null }) => ({
        post: row.post,
        user: row.user,
        workRequest: null,
      }));
    }

    const savedIds = new Set<string>();
    if (filters?.viewerId && results.length) {
      try {
        const ids = results.map((r: any) => String(r.post?.id)).filter(Boolean);
        if (ids.length) {
          const rows = await db
            .select({ postId: communityPostSaves.postId })
            .from(communityPostSaves)
            .where(
              and(
                eq(communityPostSaves.userId, filters.viewerId),
                inArray(communityPostSaves.postId, ids)
              )
            );
          for (const row of rows) {
            if (row?.postId) savedIds.add(String(row.postId));
          }
        }
      } catch (e) {
        console.warn("Failed to load community post saves", e);
      }
    }

    // Format posts with author information
    return results.map(
      ({
        post,
        user,
        workRequest,
      }: {
        post: CommunityPost;
        user: User | null;
        workRequest: WorkRequest | null;
      }) => ({
        ...post,
        hasWorkRequest: !!workRequest,
        workRequestId: workRequest?.id ?? null,
        author: {
          id: post.authorId,
          name: user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Anonymous"
            : "Anonymous",
          avatar: user?.profileImageUrl,
          role: user?.role,
          verified: user?.addressVerified || false,
          isPrivateProfile: (user as any)?.isPrivateProfile ?? false,
          badges: (user as any)?.badges ?? null,
        },
        tags: post.tags ?? [],
        location: post.countyFips ?? "",
        upvotes: post.likeCount ?? 0,
        downvotes: 0,
        comments: post.commentCount ?? 0,
        pinned: post.isPinned ?? false,
        trending:
          sortMode === "trending" ? (post.likeCount ?? 0) + (post.commentCount ?? 0) >= 3 : false,
        saved: savedIds.has(String(post.id)),
      })
    );
  }

  async getSavedCommunityPosts(
    userId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<
    Array<
      CommunityPost & {
        author: {
          id: string;
          name: string;
          avatar?: string | null;
          role?: string | null;
          verified: boolean;
          isPrivateProfile: boolean;
          badges?: string[] | null;
        };
        tags: string[];
        location: string;
        upvotes: number;
        downvotes: number;
        comments: number;
        pinned: boolean;
        trending: boolean;
        hasWorkRequest: boolean;
        workRequestId?: string | null;
        saved?: boolean;
      }
    >
  > {
    const conditions = [
      eq(communityPostSaves.userId, userId),
      eq(communityPosts.isPublished, true),
      eq(communityPosts.isHidden, false),
    ];

    const results = await db
      .select({
        post: communityPosts,
        user: users,
        workRequest: workRequests,
        savedAt: communityPostSaves.createdAt,
      })
      .from(communityPostSaves)
      .innerJoin(communityPosts, eq(communityPostSaves.postId, communityPosts.id))
      .leftJoin(users, eq(communityPosts.authorId, users.id))
      .leftJoin(
        workRequests,
        and(
          eq(workRequests.source, "community" as any),
          eq(workRequests.sourceRefId, communityPosts.id as any)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(communityPostSaves.createdAt), desc(communityPosts.createdAt))
      .limit(opts?.limit ?? 20)
      .offset(opts?.offset ?? 0);

    return results.map(({ post, user, workRequest }) => ({
      ...post,
      hasWorkRequest: !!workRequest,
      workRequestId: workRequest?.id ?? null,
      author: {
        id: post.authorId,
        name: user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Anonymous"
          : "Anonymous",
        avatar: user?.profileImageUrl,
        role: user?.role,
        verified: user?.addressVerified || false,
        isPrivateProfile: (user as any)?.isPrivateProfile ?? false,
        badges: (user as any)?.badges ?? null,
      },
      tags: post.tags ?? [],
      location: post.countyFips ?? "",
      upvotes: post.likeCount ?? 0,
      downvotes: 0,
      comments: post.commentCount ?? 0,
      pinned: post.isPinned ?? false,
      trending: false,
      saved: true,
    }));
  }

  async getCommunityPost(id: string): Promise<CommunityPost | undefined> {
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, id));
    return post;
  }

  async togglePostLike(
    userId: string,
    postId: string
  ): Promise<{ liked: boolean; likeCount: number }> {
    // Check if like exists
    const [existingLike] = await db
      .select()
      .from(postLikes)
      .where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)));

    if (existingLike) {
      // Remove like
      await db.delete(postLikes).where(eq(postLikes.id, existingLike.id));

      await db
        .update(communityPosts)
        .set({
          likeCount: sql`${communityPosts.likeCount} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(communityPosts.id, postId));

      const [post] = await db
        .select({ likeCount: communityPosts.likeCount })
        .from(communityPosts)
        .where(eq(communityPosts.id, postId));

      return { liked: false, likeCount: post?.likeCount ?? 0 };
    } else {
      // Add like
      await db.insert(postLikes).values({ userId, postId });

      await db
        .update(communityPosts)
        .set({
          likeCount: sql`${communityPosts.likeCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(communityPosts.id, postId));

      const [post] = await db
        .select({ likeCount: communityPosts.likeCount })
        .from(communityPosts)
        .where(eq(communityPosts.id, postId));

      return { liked: true, likeCount: post?.likeCount ?? 0 };
    }
  }

  async createPostComment(comment: InsertPostComment): Promise<PostComment> {
    const [newComment] = await db
      .insert(postComments)
      .values(comment as any)
      .returning();

    // Update comment count on the post
    await db
      .update(communityPosts)
      .set({
        commentCount: sql`${communityPosts.commentCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, comment.postId));

    return newComment;
  }

  async getPostComments(postId: string): Promise<PostComment[]> {
    return await db
      .select()
      .from(postComments)
      .where(eq(postComments.postId, postId))
      .orderBy(asc(postComments.createdAt));
  }

  async getPostComment(id: string): Promise<PostComment | undefined> {
    const [comment] = await db.select().from(postComments).where(eq(postComments.id, id));
    return comment;
  }

  async getCommunityGroups(filters?: {
    scope?: string;
    stateCode?: string;
    countyFips?: string;
    limit?: number;
    offset?: number;
  }): Promise<CommunityGroup[]> {
    const scopeValues = communityGroups.scope.enumValues ?? [];

    const conditions: SQL[] = [eq(communityGroups.isActive, true)];

    if (filters?.scope && scopeValues.includes(filters.scope as any)) {
      conditions.push(eq(communityGroups.scope, filters.scope as (typeof scopeValues)[number]));
    }
    if (filters?.stateCode) {
      conditions.push(eq(communityGroups.stateCode, filters.stateCode));
    }
    if (filters?.countyFips) {
      conditions.push(eq(communityGroups.countyFips, filters.countyFips));
    }

    const limit = filters?.limit ?? 20;
    const offset = filters?.offset ?? 0;

    return await db
      .select()
      .from(communityGroups)
      .where(and(...conditions))
      .orderBy(desc(communityGroups.memberCount), desc(communityGroups.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getRegions(filters?: {
    stateCode?: string;
    isOfficial?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Region[]> {
    const conditions: SQL[] = [];

    if (filters?.stateCode) {
      conditions.push(sql`${filters.stateCode} = ANY(${regions.statesCovered})`);
    }
    if (filters?.isOfficial !== undefined) {
      conditions.push(eq(regions.isOfficial, filters.isOfficial));
    }

    const whereClause: SQL = and(...conditions) ?? sql`true`;
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    return await db
      .select()
      .from(regions)
      .where(whereClause)
      .orderBy(desc(regions.isOfficial), asc(regions.name))
      .limit(limit)
      .offset(offset);
  }

  // Leaderboard operations
  async updateContractorLeaderboardStats(contractorId: string, rating: number): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      const [latestStats] = await db
        .select()
        .from(contractorLeaderboardStats)
        .where(eq(contractorLeaderboardStats.contractorId, contractorId))
        .orderBy(desc(contractorLeaderboardStats.lastUpdated))
        .limit(1);

      const positiveDelta = rating > 0 ? 1 : 0;
      const negativeDelta = rating > 0 ? 0 : 1;
      const totalDelta = positiveDelta + negativeDelta;

      // Get existing stats for this month/year
      const [existingStats] = await db
        .select()
        .from(contractorLeaderboardStats)
        .where(
          and(
            eq(contractorLeaderboardStats.contractorId, contractorId),
            eq(contractorLeaderboardStats.month, month),
            eq(contractorLeaderboardStats.year, year)
          )
        );

      if (existingStats) {
        const baseLifetimePositive =
          existingStats.lifetimePositiveRecommendations ??
          latestStats?.lifetimePositiveRecommendations ??
          0;
        const baseLifetimeNegative =
          existingStats.lifetimeNegativeRecommendations ??
          latestStats?.lifetimeNegativeRecommendations ??
          0;
        const baseLifetimeTotal =
          existingStats.lifetimeTotalRecommendations ??
          latestStats?.lifetimeTotalRecommendations ??
          0;

        const monthlyPositive = (existingStats.monthlyPositiveRecommendations ?? 0) + positiveDelta;
        const monthlyNegative = (existingStats.monthlyNegativeRecommendations ?? 0) + negativeDelta;
        const monthlyTotal = (existingStats.monthlyTotalRecommendations ?? 0) + totalDelta;

        const lifetimePositive = baseLifetimePositive + positiveDelta;
        const lifetimeNegative = baseLifetimeNegative + negativeDelta;
        const lifetimeTotal = baseLifetimeTotal + totalDelta;

        const monthlyScore = monthlyPositive - monthlyNegative;
        const lifetimeScore = lifetimePositive - lifetimeNegative;

        const monthlyPercentage =
          monthlyTotal > 0 ? ((monthlyPositive / monthlyTotal) * 100).toFixed(2) : null;
        const lifetimePercentage =
          lifetimeTotal > 0 ? ((lifetimePositive / lifetimeTotal) * 100).toFixed(2) : null;

        await db
          .update(contractorLeaderboardStats)
          .set({
            monthlyPositiveRecommendations: monthlyPositive,
            monthlyNegativeRecommendations: monthlyNegative,
            monthlyTotalRecommendations: monthlyTotal,
            monthlyRecommendationScore: monthlyScore.toString(),
            monthlyRecommendationPercentage: monthlyPercentage,
            lifetimePositiveRecommendations: lifetimePositive,
            lifetimeNegativeRecommendations: lifetimeNegative,
            lifetimeTotalRecommendations: lifetimeTotal,
            lifetimeRecommendationScore: lifetimeScore.toString(),
            lifetimeRecommendationPercentage: lifetimePercentage,
            lastUpdated: now,
          })
          .where(eq(contractorLeaderboardStats.id, existingStats.id));
      } else {
        const baseLifetimePositive = latestStats?.lifetimePositiveRecommendations ?? 0;
        const baseLifetimeNegative = latestStats?.lifetimeNegativeRecommendations ?? 0;
        const baseLifetimeTotal = latestStats?.lifetimeTotalRecommendations ?? 0;

        const monthlyPositive = positiveDelta;
        const monthlyNegative = negativeDelta;
        const monthlyTotal = totalDelta;

        const lifetimePositive = baseLifetimePositive + positiveDelta;
        const lifetimeNegative = baseLifetimeNegative + negativeDelta;
        const lifetimeTotal = baseLifetimeTotal + totalDelta;

        const monthlyScore = monthlyPositive - monthlyNegative;
        const lifetimeScore = lifetimePositive - lifetimeNegative;

        const monthlyPercentage =
          monthlyTotal > 0 ? ((monthlyPositive / monthlyTotal) * 100).toFixed(2) : null;
        const lifetimePercentage =
          lifetimeTotal > 0 ? ((lifetimePositive / lifetimeTotal) * 100).toFixed(2) : null;

        // Create new record
        await db.insert(contractorLeaderboardStats).values({
          contractorId,
          month,
          year,
          monthlyPositiveRecommendations: monthlyPositive,
          monthlyNegativeRecommendations: monthlyNegative,
          monthlyTotalRecommendations: monthlyTotal,
          monthlyRecommendationScore: monthlyScore.toString(),
          monthlyRecommendationPercentage: monthlyPercentage,
          lifetimePositiveRecommendations: lifetimePositive,
          lifetimeNegativeRecommendations: lifetimeNegative,
          lifetimeTotalRecommendations: lifetimeTotal,
          lifetimeRecommendationScore: lifetimeScore.toString(),
          lifetimeRecommendationPercentage: lifetimePercentage,
          lastUpdated: now,
        });
      }
    } catch (error: any) {
      console.error("Error updating leaderboard stats:", error);
    }
  }

  async getMonthlyLeaderboard(
    month: number,
    year: number,
    limit: number,
    state?: string,
    county?: string
  ): Promise<any> {
    try {
      // Use direct SQL with pool.query to avoid Drizzle issues
      const { Pool } = await import("@neondatabase/serverless");
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });

      let query = `
        SELECT
          cls.contractor_id,
          c.company_name,
          c.slug,
          cls.monthly_total_recommendations,
          cls.monthly_recommendation_score,
          cls.monthly_positive_recommendations,
          cls.monthly_negative_recommendations,
          cls.lifetime_total_recommendations,
          cls.lifetime_recommendation_score,
          u.city,
          u.county,
          u.state,
          u.state_code
        FROM contractor_leaderboard_stats cls
        INNER JOIN contractors c ON cls.contractor_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE cls.month = $1
          AND cls.year = $2
          AND c.is_active = true
      `;

      const params: Array<string | number> = [month, year];
      if (state && state !== "all") {
        query += ` AND (
          UPPER(COALESCE(u.state_code, '')) = UPPER($${params.length + 1})
          OR UPPER(COALESCE(u.state, '')) = UPPER($${params.length + 1})
        )`;
        params.push(state);
      }
      if (county && county !== "all") {
        query += ` AND (
          UPPER(COALESCE(u.county, '')) = UPPER($${params.length + 1})
          OR UPPER(COALESCE(u.city, '')) = UPPER($${params.length + 1})
          OR REGEXP_REPLACE(UPPER(COALESCE(u.county, '')), '[[:space:]]+(COUNTY|PARISH)$', '') =
             REGEXP_REPLACE(UPPER($${params.length + 1}), '[[:space:]]+(COUNTY|PARISH)$', '')
        )`;
        params.push(county);
      }

      query += `
        ORDER BY cls.monthly_total_recommendations DESC, cls.monthly_recommendation_score DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await pool.query(query, params);
      const rows = result.rows || [];

      return rows.map((row: any, index: number) => ({
        rank: index + 1,
        contractorId: row.contractor_id,
        companyName: row.company_name,
        slug: row.slug,
        monthlyRecommendations: parseInt(row.monthly_total_recommendations) || 0,
        monthlyScore: parseFloat(row.monthly_recommendation_score) || 0,
        monthlyPositive: parseInt(row.monthly_positive_recommendations) || 0,
        monthlyNegative: parseInt(row.monthly_negative_recommendations) || 0,
        lifetimeRecommendations: parseInt(row.lifetime_total_recommendations) || 0,
        lifetimeScore: parseFloat(row.lifetime_recommendation_score) || 0,
        city: row.city,
        county: row.county || null,
        state: row.state_code || row.state,
        location:
          row.city && (row.state_code || row.state)
            ? `${row.city}, ${row.state_code || row.state}`
            : row.county && (row.state_code || row.state)
              ? `${row.county}, ${row.state_code || row.state}`
              : row.state_code || row.state || null,
      }));
    } catch (error: any) {
      console.error("Error in getMonthlyLeaderboard:", error);
      return [];
    }
  }

  async getLifetimeLeaderboard(limit: number, state?: string, county?: string): Promise<any> {
    try {
      // Use direct SQL with pool.query to avoid Drizzle issues
      const { Pool } = await import("@neondatabase/serverless");
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });

      let query = `
        SELECT
          cls.contractor_id,
          c.company_name,
          c.slug,
          MAX(cls.lifetime_total_recommendations) as lifetime_total_recommendations,
          MAX(cls.lifetime_recommendation_score) as lifetime_recommendation_score,
          u.city,
          u.county,
          u.state,
          u.state_code
        FROM contractor_leaderboard_stats cls
        INNER JOIN contractors c ON cls.contractor_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.is_active = true
      `;

      const params: Array<string | number> = [];
      if (state && state !== "all") {
        query += ` AND (
          UPPER(COALESCE(u.state_code, '')) = UPPER($${params.length + 1})
          OR UPPER(COALESCE(u.state, '')) = UPPER($${params.length + 1})
        )`;
        params.push(state);
      }
      if (county && county !== "all") {
        query += ` AND (
          UPPER(COALESCE(u.county, '')) = UPPER($${params.length + 1})
          OR UPPER(COALESCE(u.city, '')) = UPPER($${params.length + 1})
          OR REGEXP_REPLACE(UPPER(COALESCE(u.county, '')), '[[:space:]]+(COUNTY|PARISH)$', '') =
             REGEXP_REPLACE(UPPER($${params.length + 1}), '[[:space:]]+(COUNTY|PARISH)$', '')
        )`;
        params.push(county);
      }

      query += `
        GROUP BY cls.contractor_id, c.company_name, c.slug, u.city, u.county, u.state, u.state_code
        ORDER BY MAX(cls.lifetime_total_recommendations) DESC, MAX(cls.lifetime_recommendation_score) DESC
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await pool.query(query, params);
      const rows = result.rows || [];

      return rows.map((row: any, index: number) => ({
        rank: index + 1,
        contractorId: row.contractor_id,
        companyName: row.company_name,
        slug: row.slug,
        lifetimeRecommendations: parseInt(row.lifetime_total_recommendations) || 0,
        lifetimeScore: parseFloat(row.lifetime_recommendation_score) || 0,
        city: row.city,
        county: row.county || null,
        state: row.state_code || row.state,
        location:
          row.city && (row.state_code || row.state)
            ? `${row.city}, ${row.state_code || row.state}`
            : row.county && (row.state_code || row.state)
              ? `${row.county}, ${row.state_code || row.state}`
              : row.state_code || row.state || null,
      }));
    } catch (error: any) {
      console.error("Error in getLifetimeLeaderboard:", error);
      return [];
    }
  }

  async getContractorLeaderboardPosition(contractorId: string): Promise<any> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Get current month stats
    const [monthlyStats] = await db
      .select()
      .from(contractorLeaderboardStats)
      .where(
        and(
          eq(contractorLeaderboardStats.contractorId, contractorId),
          eq(contractorLeaderboardStats.month, month),
          eq(contractorLeaderboardStats.year, year)
        )
      );

    // Get lifetime stats (latest record)
    const [lifetimeStats] = await db
      .select()
      .from(contractorLeaderboardStats)
      .where(eq(contractorLeaderboardStats.contractorId, contractorId))
      .orderBy(desc(contractorLeaderboardStats.lastUpdated))
      .limit(1);

    // Calculate monthly rank
    let monthlyRank = null;
    if (monthlyStats) {
      const [rankResult] = await db
        .select({ rank: sql<number>`COUNT(*) + 1` })
        .from(contractorLeaderboardStats)
        .where(
          and(
            eq(contractorLeaderboardStats.month, month),
            eq(contractorLeaderboardStats.year, year),
            gt(
              contractorLeaderboardStats.monthlyTotalRecommendations,
              monthlyStats.monthlyTotalRecommendations ?? 0
            )
          )
        );
      monthlyRank = rankResult?.rank || 1;
    }

    // Calculate lifetime rank
    let lifetimeRank = null;
    if (lifetimeStats) {
      const [rankResult] = await db
        .select({ rank: sql<number>`COUNT(*) + 1` })
        .from(contractorLeaderboardStats)
        .where(
          gt(
            contractorLeaderboardStats.lifetimeTotalRecommendations,
            lifetimeStats.lifetimeTotalRecommendations ?? 0
          )
        );
      lifetimeRank = rankResult?.rank || 1;
    }

    return {
      contractorId,
      monthly: monthlyStats
        ? {
            rank: monthlyRank,
            recommendations: monthlyStats.monthlyTotalRecommendations,
            score: monthlyStats.monthlyRecommendationScore
              ? parseFloat(monthlyStats.monthlyRecommendationScore)
              : 0,
            month,
            year,
          }
        : null,
      lifetime: lifetimeStats
        ? {
            rank: lifetimeRank,
            recommendations: lifetimeStats.lifetimeTotalRecommendations,
            score: lifetimeStats.lifetimeRecommendationScore
              ? parseFloat(lifetimeStats.lifetimeRecommendationScore)
              : 0,
          }
        : null,
    };
  }

  // Geographic data methods for leaderboard filtering
  async getAllStates(): Promise<{ code: string; name: string }[]> {
    const result = await db
      .select({
        code: counties.stateCode,
        name: counties.name,
      })
      .from(counties)
      .groupBy(counties.stateCode, counties.name)
      .orderBy(asc(counties.name));

    return result;
  }

  async getCountiesByState(
    stateCode: string
  ): Promise<{ id: string; name: string; stateCode: string }[]> {
    if (!stateCode || stateCode === "all") {
      return [];
    }

    const result = await db
      .select({
        id: counties.id,
        name: counties.name,
        stateCode: counties.stateCode,
      })
      .from(counties)
      .where(eq(counties.stateCode, stateCode))
      .orderBy(asc(counties.name));

    return result;
  }
}
