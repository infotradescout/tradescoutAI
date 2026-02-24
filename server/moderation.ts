import type { Express } from "express";
import { db } from "../src/db/drizzle-mock";
import {
  moderationVotes,
  moderationScores,
  userReputation,
  socialPosts,
  postComments,
  communityPosts,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { isAuthenticated } from "./auth";

export function setupModerationRoutes(app: Express) {
  // Vote on content (upvote, downvote, flag, hide)
  app.post("/api/moderation/vote", isAuthenticated, async (req: any, res) => {
    try {
      const { targetType, targetId, voteType, reason } = (req.body ?? {}) as any;
      const voterId = req.user.id;

      if (!targetType || !targetId || !voteType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      if (!["upvote", "downvote", "flag", "hide"].includes(voteType)) {
        return res.status(400).json({ error: "Invalid vote type" });
      }

      // Get user's voting weight from reputation
      const [userRep] = await db
        .select()
        .from(userReputation)
        .where(eq(userReputation.userId, voterId));

      const voteWeight = userRep?.voteWeight ? parseFloat(userRep.voteWeight) : 1.0;

      // Check if user already voted on this content
      const [existingVote] = await db
        .select()
        .from(moderationVotes)
        .where(
          and(
            eq(moderationVotes.voterId, voterId),
            eq(moderationVotes.targetType, targetType),
            eq(moderationVotes.targetId, targetId),
            eq(moderationVotes.isActive, true)
          )
        );

      if (existingVote) {
        // Update existing vote
        await db
          .update(moderationVotes)
          .set({
            voteType,
            reason,
            weight: Math.round(voteWeight * 100) / 100,
          })
          .where(eq(moderationVotes.id, existingVote.id));
      } else {
        // Create new vote
        await db.insert(moderationVotes).values({
          voterId,
          targetType,
          targetId,
          voteType,
          reason,
          weight: Math.round(voteWeight * 100) / 100,
        });
      }

      // Recalculate scores for the target content
      await recalculateModerationScore(targetType, targetId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error processing moderation vote:", error);
      res.status(500).json({ error: "Failed to process vote" });
    }
  });

  // Get moderation score for content
  app.get("/api/moderation/score/:targetType/:targetId", async (req, res) => {
    try {
      const { targetType, targetId } = req.params;

      const [score] = await db
        .select()
        .from(moderationScores)
        .where(
          and(eq(moderationScores.targetType, targetType), eq(moderationScores.targetId, targetId))
        );

      res.json(
        score || {
          upvote_count: 0,
          downvote_count: 0,
          flag_count: 0,
          hide_count: 0,
          community_score: 0,
          is_hidden: false,
          is_flagged: false,
        }
      );
    } catch (error) {
      console.error("Error fetching moderation score:", error);
      res.status(500).json({ error: "Failed to fetch score" });
    }
  });

  // Get user's vote on specific content
  app.get(
    "/api/moderation/user-vote/:targetType/:targetId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { targetType, targetId } = req.params;
        const userId = req.user.id;

        const [vote] = await db
          .select()
          .from(moderationVotes)
          .where(
            and(
              eq(moderationVotes.voterId, userId),
              eq(moderationVotes.targetType, targetType),
              eq(moderationVotes.targetId, targetId),
              eq(moderationVotes.isActive, true)
            )
          );

        res.json(vote || null);
      } catch (error) {
        console.error("Error fetching user vote:", error);
        res.status(500).json({ error: "Failed to fetch user vote" });
      }
    }
  );

  // Get user's reputation
  app.get("/api/moderation/reputation", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [reputation] = await db
        .select()
        .from(userReputation)
        .where(eq(userReputation.userId, userId));

      if (!reputation) {
        // Create initial reputation for new user
        const [newRep] = await db.insert(userReputation).values({ userId }).returning();
        return res.json(newRep);
      }

      res.json(reputation);
    } catch (error) {
      console.error("Error fetching user reputation:", error);
      res.status(500).json({ error: "Failed to fetch reputation" });
    }
  });

  // Bulk get moderation scores for multiple content items
  app.post("/api/moderation/bulk-scores", async (req, res) => {
    try {
      const { items } = (req.body ?? {}) as any;

      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items must be an array" });
      }

      const scores = await Promise.all(
        items.map(async ({ targetType, targetId }) => {
          const [score] = await db
            .select()
            .from(moderationScores)
            .where(
              and(
                eq(moderationScores.targetType, targetType),
                eq(moderationScores.targetId, targetId)
              )
            );

          return {
            targetType,
            targetId,
            score: score || {
              upvoteCount: 0,
              downvoteCount: 0,
              flagCount: 0,
              hideCount: 0,
              communityScore: 0,
              isHidden: false,
              isFlagged: false,
            },
          };
        })
      );

      res.json(scores);
    } catch (error) {
      console.error("Error fetching bulk scores:", error);
      res.status(500).json({ error: "Failed to fetch scores" });
    }
  });
}

// Helper function to recalculate moderation scores
async function recalculateModerationScore(targetType: string, targetId: string) {
  try {
    // Count votes by type with weights
    const voteResults = await db
      .select({
        voteType: moderationVotes.voteType,
        totalWeight: sql<number>`sum(${moderationVotes.weight})`,
        count: sql<number>`count(*)`,
      })
      .from(moderationVotes)
      .where(
        and(
          eq(moderationVotes.targetType, targetType),
          eq(moderationVotes.targetId, targetId),
          eq(moderationVotes.isActive, true)
        )
      )
      .groupBy(moderationVotes.voteType);

    let upvoteCount = 0,
      downvoteCount = 0,
      flagCount = 0,
      hideCount = 0;
    let upvoteWeight = 0,
      downvoteWeight = 0;

    voteResults.forEach((result: any) => {
      const count = parseInt(result.count.toString());
      const weight = parseFloat(result.totalWeight.toString());

      switch (result.voteType) {
        case "upvote":
          upvoteCount = count;
          upvoteWeight = weight;
          break;
        case "downvote":
          downvoteCount = count;
          downvoteWeight = weight;
          break;
        case "flag":
          flagCount = count;
          break;
        case "hide":
          hideCount = count;
          break;
      }
    });

    // Calculate community score (weighted upvotes - weighted downvotes)
    const communityScore = Math.round((upvoteWeight - downvoteWeight) * 100) / 100;

    // Auto-hide if hide count exceeds threshold (5 votes) or community score is very negative
    const isHidden = hideCount >= 5 || communityScore <= -10;

    // Auto-flag if flag count exceeds threshold (3 votes)
    const isFlagged = flagCount >= 3;

    // Update or create moderation score
    const [existingScore] = await db
      .select()
      .from(moderationScores)
      .where(
        and(eq(moderationScores.targetType, targetType), eq(moderationScores.targetId, targetId))
      );

    if (existingScore) {
      await db
        .update(moderationScores)
        .set({
          upvoteCount,
          downvoteCount,
          flagCount,
          hideCount,
          communityScore,
          isHidden,
          isFlagged,
          lastCalculated: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(moderationScores.id, existingScore.id));
    } else {
      await db.insert(moderationScores).values({
        targetType,
        targetId,
        upvoteCount,
        downvoteCount,
        flagCount,
        hideCount,
        communityScore,
        isHidden,
        isFlagged,
      });
    }

    return {
      upvoteCount,
      downvoteCount,
      flagCount,
      hideCount,
      communityScore,
      isHidden,
      isFlagged,
    };
  } catch (error) {
    console.error("Error recalculating moderation score:", error);
    throw error;
  }
}

// Admin moderation routes
export function setupAdminModerationRoutes(app: Express) {
  // Check if user is super admin
  const isSuperAdmin = (user: any) => {
    return (
      user?.role === "super_admin" || user?.role === "head_admin" || user?.isSuperAdmin === true
    );
  };

  // Get all flagged content for review
  app.get("/api/admin/moderation/flagged", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const flaggedItems = await db
        .select()
        .from(moderationScores)
        .where(eq(moderationScores.isFlagged, true));

      res.json(flaggedItems || []);
    } catch (error) {
      console.error("Error fetching flagged content:", error);
      res.status(500).json({ error: "Failed to fetch flagged content" });
    }
  });

  // Get all user reports for review
  app.get("/api/admin/moderation/reports", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Return metrics about moderation status
      const flaggedCount = await db
        .select()
        .from(moderationScores)
        .where(eq(moderationScores.isFlagged, true));

      const hiddenCount = await db
        .select()
        .from(moderationScores)
        .where(eq(moderationScores.isHidden, true));

      res.json({
        flaggedContentCount: flaggedCount.length,
        hiddenContentCount: hiddenCount.length,
        totalFlags: flaggedCount.reduce((sum: number, item: any) => sum + (item.flagCount || 0), 0),
        totalReports: 0,
      });
    } catch (error) {
      console.error("Error fetching moderation reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  // Approve flagged content (remove flag)
  app.post("/api/admin/moderation/approve/:contentId", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const { contentId } = req.params;
      const { targetType } = req.body;

      if (!contentId || !targetType) {
        return res.status(400).json({ error: "Missing contentId or targetType" });
      }

      // Reset flagged status
      await db
        .update(moderationScores)
        .set({
          isFlagged: false,
          updatedAt: new Date(),
        })
        .where(
          and(eq(moderationScores.targetId, contentId), eq(moderationScores.targetType, targetType))
        );

      res.json({ success: true, message: "Content approved" });
    } catch (error) {
      console.error("Error approving content:", error);
      res.status(500).json({ error: "Failed to approve content" });
    }
  });

  // Remove flagged content
  app.post("/api/admin/moderation/remove/:contentId", isAuthenticated, async (req: any, res) => {
    try {
      if (!isSuperAdmin(req.user)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const { contentId } = req.params;
      const { targetType, reason } = req.body;

      if (!contentId || !targetType) {
        return res.status(400).json({ error: "Missing contentId or targetType" });
      }

      const normalizedTargetType = String(targetType).toLowerCase();

      if (normalizedTargetType === "post" || normalizedTargetType === "community_post") {
        await db.delete(communityPosts).where(eq(communityPosts.id, String(contentId)));
      }

      // Mark as hidden and flagged resolved
      await db
        .update(moderationScores)
        .set({
          isFlagged: false,
          isHidden: true,
          updatedAt: new Date(),
        })
        .where(
          and(eq(moderationScores.targetId, contentId), eq(moderationScores.targetType, targetType))
        );

      console.log(
        `[ADMIN_MODERATION_REMOVE] admin=${req.user?.id || req.user?.claims?.sub || "unknown"} targetType=${normalizedTargetType} contentId=${contentId} reason=${String(reason || "")} timestamp=${new Date().toISOString()}`
      );

      res.json({ success: true, message: "Content removed" });
    } catch (error) {
      console.error("Error removing content:", error);
      res.status(500).json({ error: "Failed to remove content" });
    }
  });
}
