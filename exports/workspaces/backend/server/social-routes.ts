import type { Express } from "express";
import { eq, desc, and, or, like, sql, count, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  socialPosts,
  postReactions,
  postComments,
  commentReactions,
  postShares,
  contentReports,
  userFollows,
  neighborhoods,
  users,
  socialPostSaves,
  profiles,
} from "@shared/schema";
import { storage } from "./storage";
import { isAuthenticated, requirePermission } from "./auth";
import { z } from "zod";
import type { User } from "@shared/schema";
import { ensureContactRequest, getContactPermission } from "./utils/contactRequests";

const ALLOWED_REACTIONS = [
  "like",
  "love",
  "laugh",
  "wow",
  "sad",
  "angry",
  "helpful",
  "thanks",
] as const;

type ReactionType = (typeof ALLOWED_REACTIONS)[number];

export function registerSocialRoutes(app: Express) {
  const enforceCommentContactGate =
    String(process.env.ENFORCE_COMMENT_CONTACT_GATE || "")
      .trim()
      .toLowerCase() === "true";

  // Get social feed with filters
  app.get("/api/social/feed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const {
        postType = "all",
        location = "neighborhood",
        sortBy = "recent",
        search = "",
        page = 1,
        limit = 10,
        scope = "all", // all | connections (future scopes can be added)
      } = req.query as any;

      const limitNumber = parseInt(limit);
      const offset = (parseInt(page) - 1) * limitNumber;

      // Build query conditions
      const whereConditions: any[] = [];

      // Post type filter
      if (postType !== "all") {
        whereConditions.push(eq(socialPosts.postType, postType));
      }

      // Location filter (simplified for now)
      if (location === "neighborhood") {
        // Filter by user's county/state
        const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (user[0]?.county) {
          whereConditions.push(eq(socialPosts.county, user[0].county));
        }
      }

      // Scope filter: when viewing "connections" only show posts from people the user follows
      if (scope === "connections") {
        const followingRows = await db
          .select({ followingId: userFollows.followingId })
          .from(userFollows)
          .where(eq(userFollows.followerId, userId));

        const followingIds = followingRows.map((row: any) => row.followingId).filter(Boolean);

        if (followingIds.length === 0) {
          // User has no connections yet; return empty feed quickly
          return res.json([]);
        }

        whereConditions.push(inArray(socialPosts.authorId, followingIds));
      }

      // Search filter
      if (search) {
        whereConditions.push(
          or(
            like(socialPosts.content, `%${search}%`),
            sql`${socialPosts.tags} @> ${JSON.stringify([search])}`
          )
        );
      }

      // Base query
      let query: any = db
        .select({
          post: socialPosts,
          author: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            isVerified: users.addressVerified,
          },
          reactionCount: sql<number>`count(distinct ${postReactions.id})`,
          commentCount: sql<number>`count(distinct ${postComments.id})`,
          shareCount: sql<number>`count(distinct ${postShares.id})`,
        })
        .from(socialPosts)
        .leftJoin(users, eq(socialPosts.authorId, users.id))
        .leftJoin(postReactions, eq(socialPosts.id, postReactions.postId))
        .leftJoin(postComments, eq(socialPosts.id, postComments.postId))
        .leftJoin(postShares, eq(socialPosts.id, postShares.postId))
        .where(and(eq(socialPosts.isArchived, false), ...whereConditions))
        .groupBy(socialPosts.id, users.id);

      // Apply basic sorting
      if (sortBy === "popular") {
        query = query.orderBy(desc(socialPosts.createdAt));
      } else {
        // Default to most recent first
        query = query.orderBy(desc(socialPosts.createdAt));
      }

      // Apply pagination
      const posts: any[] = await query.limit(limitNumber).offset(offset);

      // Get user reactions for each post
      const postIds = posts.map((p: any) => p.post.id);
      const userReactions =
        postIds.length > 0
          ? await db
              .select()
              .from(postReactions)
              .where(and(inArray(postReactions.postId, postIds), eq(postReactions.userId, userId)))
          : [];

      // Get all reactions for each post
      const allReactions =
        postIds.length > 0
          ? await db.select().from(postReactions).where(inArray(postReactions.postId, postIds))
          : [];

      // Combine data
      const postsWithReactions = posts.map(
        ({ post, author, reactionCount, commentCount, shareCount }: any) => ({
          ...post,
          author,
          reactions: allReactions.filter((r: any) => r.postId === post.id),
          userReaction: userReactions.find((r: any) => r.postId === post.id),
          _count: {
            reactions: parseInt(reactionCount.toString()),
            comments: parseInt(commentCount.toString()),
            shares: parseInt(shareCount.toString()),
          },
        })
      );

      res.json(postsWithReactions);
    } catch (error) {
      console.error("Error fetching social feed:", error);
      res.status(500).json({ message: "Failed to fetch social feed" });
    }
  });

  // Create new post
  app.post("/api/social/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = req.user as User;

      const postData = {
        ...req.body,
        authorId: userId,
        county: user.county,
        state: user.state,
      };

      const [post] = await db.insert(socialPosts).values(postData).returning();
      try {
        await storage.logEvent("post.created", {
          userId,
          postId: post.id,
          scopeType: "county",
          scopeId: user.county || null,
          countyFips: (user as any).countyFips || null,
        });
      } catch (e) {
        console.error("Failed to log post.created for XP", e);
      }

      res.json(post);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({ message: "Failed to create post" });
    }
  });

  // Get single post
  app.get("/api/social/posts/:postId", async (req, res) => {
    try {
      const { postId } = req.params;

      const [post] = await db
        .select({
          post: socialPosts,
          author: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            isVerified: users.addressVerified,
          },
        })
        .from(socialPosts)
        .leftJoin(users, eq(socialPosts.authorId, users.id))
        .where(eq(socialPosts.id, postId))
        .limit(1);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Get reactions and comments count
      const [reactionCount] = await db
        .select({ count: count() })
        .from(postReactions)
        .where(eq(postReactions.postId, postId));

      const [commentCount] = await db
        .select({ count: count() })
        .from(postComments)
        .where(eq(postComments.postId, postId));

      const [shareCount] = await db
        .select({ count: count() })
        .from(postShares)
        .where(eq(postShares.postId, postId));

      const postWithCounts = {
        ...post.post,
        author: post.author,
        _count: {
          reactions: reactionCount.count,
          comments: commentCount.count,
          shares: shareCount.count,
        },
      };

      res.json(postWithCounts);
    } catch (error) {
      console.error("Error fetching post:", error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  // Save/bookmark a post
  app.post("/api/social/posts/:postId/save", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.params as { postId: string };

      const [post] = await db
        .select({ id: socialPosts.id, authorId: socialPosts.authorId })
        .from(socialPosts)
        .where(eq(socialPosts.id, postId))
        .limit(1);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const [existing] = await db
        .select()
        .from(socialPostSaves)
        .where(and(eq(socialPostSaves.userId, userId), eq(socialPostSaves.postId, postId)))
        .limit(1);

      if (!existing) {
        await db.insert(socialPostSaves).values({ userId, postId }).returning();

        try {
          await storage.logEvent("post.saved", {
            userId,
            targetUserId: post.authorId,
            postId,
          });
        } catch (e) {
          console.error("Failed to log post.saved for XP", e);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving post:", error);
      res.status(500).json({ message: "Failed to save post" });
    }
  });

  // React to post
  app.post("/api/social/posts/:postId/reactions", isAuthenticated, async (req: any, res) => {
    try {
      const { postId } = req.params;
      const { reactionType } = (req.body ?? {}) as any;
      const userId = req.user.id;

      if (typeof reactionType !== "string" || !reactionType.trim()) {
        return res.status(400).json({ message: "Invalid reaction type" });
      }

      if (!ALLOWED_REACTIONS.includes(reactionType as ReactionType)) {
        return res.status(400).json({ message: "Unsupported reaction type" });
      }

      const typedReactionType = reactionType as ReactionType;

      // Check if user already reacted
      const [existingReaction] = await db
        .select()
        .from(postReactions)
        .where(and(eq(postReactions.postId, postId), eq(postReactions.userId, userId)))
        .limit(1);

      if (existingReaction) {
        // Update existing reaction
        await db
          .update(postReactions)
          .set({ reactionType: typedReactionType })
          .where(eq(postReactions.id, existingReaction.id));
      } else {
        // Create new reaction
        await db.insert(postReactions).values({
          postId,
          userId,
          reactionType: typedReactionType,
        });
      }
      try {
        if (typedReactionType === "helpful" || typedReactionType === "thanks") {
          const [post] = await db
            .select({ authorId: socialPosts.authorId })
            .from(socialPosts)
            .where(eq(socialPosts.id, postId))
            .limit(1);

          if (post?.authorId && post.authorId !== userId) {
            await storage.logEvent(
              typedReactionType === "helpful" ? "reaction.marked_helpful" : "user.thanked",
              {
                userId,
                targetUserId: post.authorId,
                postId,
              }
            );
          }
        }
      } catch (e) {
        console.error("Failed to log reaction XP event", e);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error reacting to post:", error);
      res.status(500).json({ message: "Failed to react to post" });
    }
  });

  // Remove reaction from post
  app.delete("/api/social/posts/:postId/reactions", isAuthenticated, async (req: any, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user.id;

      await db
        .delete(postReactions)
        .where(and(eq(postReactions.postId, postId), eq(postReactions.userId, userId)));

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing reaction:", error);
      res.status(500).json({ message: "Failed to remove reaction" });
    }
  });

  // Get comments for a post
  app.get("/api/social/posts/:postId/comments", async (req, res) => {
    try {
      const { postId } = req.params;

      const comments = await db
        .select({
          comment: postComments,
          author: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            isVerified: users.addressVerified,
          },
          reactionCount: sql<number>`count(distinct ${commentReactions.id})`,
        })
        .from(postComments)
        .leftJoin(users, eq(postComments.authorId, users.id))
        .leftJoin(commentReactions, eq(postComments.id, commentReactions.commentId))
        .where(
          and(
            eq(postComments.postId, postId),
            sql`${postComments.parentCommentId} IS NULL` // Only top-level comments
          )
        )
        .groupBy(postComments.id, users.id)
        .orderBy(desc(postComments.createdAt));

      // Get replies for each comment
      const commentIds = comments.map((c: any) => c.comment.id);
      const replies =
        commentIds.length > 0
          ? await db
              .select({
                comment: postComments,
                author: {
                  id: users.id,
                  firstName: users.firstName,
                  lastName: users.lastName,
                  profileImageUrl: users.profileImageUrl,
                  role: users.role,
                  isVerified: users.addressVerified,
                },
              })
              .from(postComments)
              .leftJoin(users, eq(postComments.authorId, users.id))
              .where(inArray(postComments.parentCommentId, commentIds))
              .orderBy(postComments.createdAt)
          : [];

      // Organize replies under their parent comments
      const commentsWithReplies = comments.map(({ comment, author, reactionCount }: any) => ({
        ...comment,
        author,
        replies: replies
          .filter((r: any) => r.comment.parentCommentId === comment.id)
          .map((r: any) => ({
            ...r.comment,
            author: r.author,
            reactions: [],
            _count: { reactions: 0, replies: 0 },
          })),
        reactions: [],
        _count: {
          reactions: parseInt(reactionCount.toString()),
          replies: replies.filter((r: any) => r.comment.parentCommentId === comment.id).length,
        },
      }));

      res.json(commentsWithReplies);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Create comment
  app.post("/api/social/posts/:postId/comments", isAuthenticated, async (req: any, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user.id;
      const { content, parentCommentId } = (req.body ?? {}) as any;

      if (typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      const [post] = await db
        .select({ authorId: socialPosts.authorId })
        .from(socialPosts)
        .where(eq(socialPosts.id, postId))
        .limit(1);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (enforceCommentContactGate && post.authorId && String(post.authorId) !== String(userId)) {
        const requester = await storage.getUser(String(userId));
        const requesterCountyFips = (requester as any)?.countyFips || null;
        const permission = await getContactPermission(String(userId), String(post.authorId));
        if (permission?.status === "accepted") {
          // proceed
        } else if (permission?.status === "pending") {
          return res.status(202).json({
            pending: true,
            requestId: permission.lastRequestNotificationId || null,
            message: "Contact request already pending recipient approval.",
          });
        } else if (permission?.status === "declined" || permission?.status === "blocked") {
          return res.status(403).json({
            message: "Recipient has declined first contact.",
            reasonCode: "CONTACT_DECLINED",
          });
        } else {
          const ensure = await ensureContactRequest({
            requesterId: String(userId),
            targetUserId: String(post.authorId),
            preview: content,
            metadata: {
              contactType: "comment",
              content,
              postId,
              parentCommentId: parentCommentId || null,
              source: "social",
              countyFips: requesterCountyFips,
            },
          });

          if (ensure.status === "pending") {
            return res.status(202).json({
              pending: true,
              requestId: ensure.requestId || null,
              message: "Contact request sent. Recipient must accept before comment posts.",
            });
          }
        }
      }

      const [comment] = await db
        .insert(postComments)
        .values({
          postId,
          authorId: userId,
          content,
          parentCommentId: parentCommentId || null,
        })
        .returning();
      try {
        await storage.logEvent("comment.created", {
          userId,
          commentId: comment.id,
          postId,
        });
      } catch (e) {
        console.error("Failed to log comment.created for XP", e);
      }

      res.json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Share post
  app.post("/api/social/posts/:postId/share", isAuthenticated, async (req: any, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user.id;
      const { shareMessage, privacyLevel } = (req.body ?? {}) as any;

      // Check if post exists
      const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId)).limit(1);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Create share record
      const [share] = await db
        .insert(postShares)
        .values({
          postId,
          userId,
          shareMessage: shareMessage || null,
          privacyLevel: privacyLevel || "neighborhood",
        })
        .returning();

      // Update share count
      await db
        .update(socialPosts)
        .set({
          shareCount: sql`${socialPosts.shareCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, postId));

      res.json(share);
    } catch (error) {
      console.error("Error sharing post:", error);
      res.status(500).json({ message: "Failed to share post" });
    }
  });

  // Pin/unpin post (moderators only)
  app.patch(
    "/api/social/posts/:postId/pin",
    isAuthenticated,
    requirePermission("canModerateContent"),
    async (req: any, res) => {
      try {
        const { postId } = req.params;
        const { isPinned } = (req.body ?? {}) as any;

        if (typeof isPinned !== "boolean") {
          return res.status(400).json({ message: "isPinned must be a boolean" });
        }

        await db
          .update(socialPosts)
          .set({
            isPinned: isPinned,
            updatedAt: new Date(),
          })
          .where(eq(socialPosts.id, postId));

        res.json({ success: true });
      } catch (error) {
        console.error("Error pinning post:", error);
        res.status(500).json({ message: "Failed to pin post" });
      }
    }
  );

  // Delete post
  app.delete("/api/social/posts/:postId", isAuthenticated, async (req: any, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user.id;

      // Check if user is the author or has moderation permissions
      const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId)).limit(1);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check permissions
      const user = req.user as User;
      const isAuthor = post.authorId === userId;
      const rawRole = typeof (user as any)?.role === "string" ? String((user as any).role) : "";
      const roleToken = rawRole.trim().toLowerCase();
      const normalizedRole =
        roleToken === "super_admin" || roleToken === "head_admin" || roleToken === "owner"
          ? "super_admin"
          : roleToken;
      const canModerate =
        normalizedRole &&
        [
          "moderator",
          "ops_admin",
          "super_admin",
          "community_moderator",
          "community_leader",
        ].includes(normalizedRole);

      if (!isAuthor && !canModerate) {
        return res.status(403).json({ message: "Not authorized to delete this post" });
      }

      // Delete post (cascade will handle related records)
      await db.delete(socialPosts).where(eq(socialPosts.id, postId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // React to comment
  app.post("/api/social/comments/:commentId/reactions", isAuthenticated, async (req: any, res) => {
    try {
      const { commentId } = req.params;
      const { reactionType } = (req.body ?? {}) as any;
      const userId = req.user.id;

      if (typeof reactionType !== "string" || !reactionType.trim()) {
        return res.status(400).json({ message: "Invalid reaction type" });
      }

      if (!ALLOWED_REACTIONS.includes(reactionType as ReactionType)) {
        return res.status(400).json({ message: "Unsupported reaction type" });
      }

      const typedReactionType = reactionType as ReactionType;

      // Check if user already reacted
      const [existingReaction] = await db
        .select()
        .from(commentReactions)
        .where(and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, userId)))
        .limit(1);

      if (existingReaction) {
        // Update existing reaction
        await db
          .update(commentReactions)
          .set({ reactionType: typedReactionType })
          .where(eq(commentReactions.id, existingReaction.id));
      } else {
        // Create new reaction
        await db.insert(commentReactions).values({
          commentId,
          userId,
          reactionType: typedReactionType,
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error reacting to comment:", error);
      res.status(500).json({ message: "Failed to react to comment" });
    }
  });

  // Remove reaction from comment
  app.delete(
    "/api/social/comments/:commentId/reactions",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { commentId } = req.params;
        const userId = req.user.id;

        await db
          .delete(commentReactions)
          .where(
            and(eq(commentReactions.commentId, commentId), eq(commentReactions.userId, userId))
          );

        res.json({ success: true });
      } catch (error) {
        console.error("Error removing reaction:", error);
        res.status(500).json({ message: "Failed to remove reaction" });
      }
    }
  );

  // Submit content report
  app.post("/api/social/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const reportData = {
        ...req.body,
        reporterId: userId,
        status: "pending",
      };

      const [report] = await db.insert(contentReports).values(reportData).returning();

      res.json(report);
    } catch (error) {
      console.error("Error submitting report:", error);
      res.status(500).json({ message: "Failed to submit report" });
    }
  });

  // Get trending topics/hashtags
  app.get("/api/social/trending", async (req, res) => {
    try {
      const originHeader = req.headers.origin;
      if (typeof originHeader === "string") {
        const allowedOrigins = new Set(
          [
            "https://www.thetradescout.com",
            "https://tradescoutai.onrender.com",

            "https://thetradescout.com",
          ].map((o) => o.toLowerCase())
        );

        if (allowedOrigins.has(originHeader.toLowerCase())) {
          res.setHeader("Access-Control-Allow-Origin", originHeader);
          res.setHeader("Access-Control-Allow-Credentials", "true");
        }
        res.setHeader("Vary", "Origin");
      }

      // Return empty array since social posts table doesn't exist yet
      res.json([]);
    } catch (error) {
      console.error("Error fetching trending topics:", error);
      res.json([]); // Return empty array on error
    }
  });

  // Get neighborhood stats
  app.get("/api/social/neighborhood-stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;

      // Get stats for user's neighborhood/county
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [postsToday] = await db
        .select({ count: count() })
        .from(socialPosts)
        .where(
          and(eq(socialPosts.county, user.county || ""), sql`${socialPosts.createdAt} >= ${today}`)
        );

      const [activeMembers] = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.county, user.county || ""));

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [newMembers] = await db
        .select({ count: count() })
        .from(users)
        .where(
          and(eq(users.county, user.county || ""), sql`${users.createdAt} >= ${thirtyDaysAgo}`)
        );

      const stats = {
        postsToday: postsToday.count,
        activeMembers: activeMembers.count,
        newMembers: newMembers.count,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching neighborhood stats:", error);
      res.json({
        postsToday: 0,
        activeMembers: 0,
        newMembers: 0,
      });
    }
  });

  // Follow another user (connections)
  app.post(
    "/api/social/connections/:targetUserId/follow",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id as string;
        const { targetUserId } = req.params as { targetUserId: string };

        if (!targetUserId || typeof targetUserId !== "string") {
          return res.status(400).json({ message: "Target user ID is required" });
        }

        if (targetUserId === userId) {
          return res.status(400).json({ message: "You cannot follow yourself" });
        }

        // Ensure target user exists
        const [target] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, targetUserId))
          .limit(1);

        if (!target) {
          return res.status(404).json({ message: "Target user not found" });
        }

        // Check existing follow relationship
        const [existing] = await db
          .select()
          .from(userFollows)
          .where(and(eq(userFollows.followerId, userId), eq(userFollows.followingId, targetUserId)))
          .limit(1);

        if (existing) {
          // Already following – return current status
          const [reverse] = await db
            .select()
            .from(userFollows)
            .where(
              and(eq(userFollows.followerId, targetUserId), eq(userFollows.followingId, userId))
            )
            .limit(1);

          return res.json({
            success: true,
            alreadyFollowing: true,
            connection: existing,
            viewerConnection: {
              isFollowing: true,
              isFollowedBy: !!reverse,
              isMutual: !!reverse,
            },
          });
        }

        const [follow] = await db
          .insert(userFollows)
          .values({
            followerId: userId,
            followingId: targetUserId,
          })
          .returning();

        const [reverse] = await db
          .select()
          .from(userFollows)
          .where(and(eq(userFollows.followerId, targetUserId), eq(userFollows.followingId, userId)))
          .limit(1);

        // Create a basic in-app notification for the target user about the new follower.
        try {
          const [followerUser] = await db
            .select({ firstName: users.firstName, lastName: users.lastName })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

          const followerName =
            [followerUser?.firstName ?? "", followerUser?.lastName ?? ""].join(" ").trim() ||
            "Someone";

          await storage.createNotification({
            userId: targetUserId,
            type: "social_follow" as any,
            title: "New follower",
            message: `${followerName} just followed you on TradeScout.`,
            actionUrl: "/connections",
          } as any);
        } catch (notifyErr) {
          console.error("[Social] Failed to create follow notification", notifyErr);
        }

        res.json({
          success: true,
          connection: follow,
          viewerConnection: {
            isFollowing: true,
            isFollowedBy: !!reverse,
            isMutual: !!reverse,
          },
        });
      } catch (error) {
        console.error("Error following user:", error);
        res.status(500).json({ message: "Failed to follow user" });
      }
    }
  );

  // Unfollow a user
  app.delete(
    "/api/social/connections/:targetUserId/follow",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id as string;
        const { targetUserId } = req.params as { targetUserId: string };

        if (!targetUserId || typeof targetUserId !== "string") {
          return res.status(400).json({ message: "Target user ID is required" });
        }

        await db
          .delete(userFollows)
          .where(
            and(eq(userFollows.followerId, userId), eq(userFollows.followingId, targetUserId))
          );

        // Check if target still follows viewer (for UI state)
        const [reverse] = await db
          .select()
          .from(userFollows)
          .where(and(eq(userFollows.followerId, targetUserId), eq(userFollows.followingId, userId)))
          .limit(1);

        res.json({
          success: true,
          viewerConnection: {
            isFollowing: false,
            isFollowedBy: !!reverse,
            isMutual: false,
          },
        });
      } catch (error) {
        console.error("Error unfollowing user:", error);
        res.status(500).json({ message: "Failed to unfollow user" });
      }
    }
  );

  // Get connection summary for the authenticated user
  app.get("/api/social/connections/summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id as string;

      const followersRows = await db
        .select({ followerId: userFollows.followerId })
        .from(userFollows)
        .where(eq(userFollows.followingId, userId));

      const followingRows = await db
        .select({ followingId: userFollows.followingId })
        .from(userFollows)
        .where(eq(userFollows.followerId, userId));

      const followerIds = new Set(followersRows.map((row: any) => row.followerId).filter(Boolean));
      const followingIds = new Set(
        followingRows.map((row: any) => row.followingId).filter(Boolean)
      );

      let mutualCount = 0;
      followerIds.forEach((id) => {
        if (followingIds.has(id)) {
          mutualCount += 1;
        }
      });

      res.json({
        followers: followerIds.size,
        following: followingIds.size,
        mutual: mutualCount,
      });
    } catch (error) {
      console.error("Error fetching connections summary:", error);
      res.status(500).json({ message: "Failed to fetch connections summary" });
    }
  });

  // List users the authenticated user is following
  app.get("/api/social/connections/following", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id as string;

      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          city: users.city,
          state: users.state,
          roles: users.roles,
          role: users.role,
          followedAt: userFollows.createdAt,
        })
        .from(userFollows)
        .innerJoin(users, eq(userFollows.followingId, users.id))
        .where(eq(userFollows.followerId, userId))
        .orderBy(desc(userFollows.createdAt));

      const profileRows = rows.length
        ? await db
            .select({ ownerUserId: profiles.ownerUserId, slug: profiles.slug })
            .from(profiles)
            .where(
              and(
                inArray(
                  profiles.ownerUserId,
                  rows.map((row) => row.id)
                ),
                eq(profiles.status, "published")
              )
            )
        : [];

      const canonicalProfileUrlByUserId = new Map<string, string>();
      for (const row of profileRows) {
        if (!canonicalProfileUrlByUserId.has(row.ownerUserId)) {
          canonicalProfileUrlByUserId.set(row.ownerUserId, `/u/${row.slug}`);
        }
      }

      res.json(
        rows.map((row) => ({
          ...row,
          canonicalProfileUrl: canonicalProfileUrlByUserId.get(row.id) ?? null,
        }))
      );
    } catch (error) {
      console.error("Error fetching following list:", error);
      res.status(500).json({ message: "Failed to fetch following list" });
    }
  });

  // List users who follow the authenticated user
  app.get("/api/social/connections/followers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id as string;

      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          city: users.city,
          state: users.state,
          roles: users.roles,
          role: users.role,
          followedAt: userFollows.createdAt,
        })
        .from(userFollows)
        .innerJoin(users, eq(userFollows.followerId, users.id))
        .where(eq(userFollows.followingId, userId))
        .orderBy(desc(userFollows.createdAt));

      const profileRows = rows.length
        ? await db
            .select({ ownerUserId: profiles.ownerUserId, slug: profiles.slug })
            .from(profiles)
            .where(
              and(
                inArray(
                  profiles.ownerUserId,
                  rows.map((row) => row.id)
                ),
                eq(profiles.status, "published")
              )
            )
        : [];

      const canonicalProfileUrlByUserId = new Map<string, string>();
      for (const row of profileRows) {
        if (!canonicalProfileUrlByUserId.has(row.ownerUserId)) {
          canonicalProfileUrlByUserId.set(row.ownerUserId, `/u/${row.slug}`);
        }
      }

      res.json(
        rows.map((row) => ({
          ...row,
          canonicalProfileUrl: canonicalProfileUrlByUserId.get(row.id) ?? null,
        }))
      );
    } catch (error) {
      console.error("Error fetching followers list:", error);
      res.status(500).json({ message: "Failed to fetch followers list" });
    }
  });
}
