import type { Express } from "express";
import { db } from "../src/db/drizzle-mock";
import {
  moderationVotes,
  moderationScores,
  userReputation,
  users,
  socialPosts,
  postComments,
  communityPosts,
  moderationReports,
  moderationActions,
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { isAuthenticated } from "./auth";
import { logAdminAction } from "./services/adminAuditLogService";

const COMMUNITY_CONFIRMATION_THRESHOLD = 3;

function normalizeRole(raw: unknown): string {
  const r = String(raw || "")
    .trim()
    .toLowerCase();
  if (!r) return "";
  if (r === "owner" || r === "head_admin") return "super_admin";
  if (r === "staff") return "moderator";
  return r;
}

function getUserRoleTokens(user: any): string[] {
  if (!user) return [];
  const roles = Array.isArray(user.roles) ? user.roles.map((v: any) => normalizeRole(v)) : [];
  return Array.from(
    new Set([normalizeRole(user.role), normalizeRole(user.activeRole), ...roles].filter(Boolean))
  );
}

function hasAnyRole(user: any, allowed: string[]): boolean {
  const tokens = new Set(getUserRoleTokens(user));
  return allowed.map(normalizeRole).some((r) => tokens.has(r));
}

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

      // Community-lever actions: only community moderators/leaders (or staff+) can hide content.
      if (
        voteType === "hide" &&
        !hasAnyRole(req.user, [
          "community_moderator",
          "community_leader",
          "moderator",
          "ops_admin",
          "super_admin",
        ])
      ) {
        return res.status(403).json({ error: "Only community moderators can hide content" });
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

  // Community moderation: vote to "kick" a user into staff review (no automatic user removal).
  app.post("/api/moderation/kick-vote", isAuthenticated, async (req: any, res) => {
    try {
      const voterId = req.user.id;
      const { userId, reason } = (req.body ?? {}) as any;
      const targetUserId = String(userId || "").trim();
      const rationale = String(reason || "").trim();

      if (!targetUserId) return res.status(400).json({ error: "userId is required" });
      if (targetUserId === voterId) {
        return res.status(400).json({ error: "You cannot vote to kick yourself" });
      }
      if (rationale.length < 10) {
        return res.status(400).json({ error: "reason is required (min 10 chars)" });
      }

      if (!hasAnyRole(req.user, ["community_moderator", "community_leader"])) {
        return res.status(403).json({ error: "Only community moderators can vote to kick users" });
      }

      const [targetUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      const [existingVote] = await db
        .select()
        .from(moderationVotes)
        .where(
          and(
            eq(moderationVotes.voterId, voterId),
            eq(moderationVotes.targetType, "user"),
            eq(moderationVotes.targetId, targetUserId),
            eq(moderationVotes.isActive, true)
          )
        );

      if (existingVote) {
        await db
          .update(moderationVotes)
          .set({
            voteType: "kick",
            reason: rationale,
            weight: 1,
          })
          .where(eq(moderationVotes.id, existingVote.id));
      } else {
        await db.insert(moderationVotes).values({
          voterId,
          targetType: "user",
          targetId: targetUserId,
          voteType: "kick",
          reason: rationale,
          weight: 1,
        });
      }

      // Count distinct community-moderator votes (exclude the target user).
      const kickVotes = await db
        .select({
          voterId: moderationVotes.voterId,
          role: users.role,
          roles: users.roles,
        })
        .from(moderationVotes)
        .leftJoin(users, eq(users.id, moderationVotes.voterId))
        .where(
          and(
            eq(moderationVotes.targetType, "user"),
            eq(moderationVotes.targetId, targetUserId),
            eq(moderationVotes.voteType, "kick"),
            eq(moderationVotes.isActive, true)
          )
        );

      const eligibleVoters = new Set<string>();
      for (const row of kickVotes as any[]) {
        if (!row?.voterId) continue;
        if (String(row.voterId) === targetUserId) continue;
        const voterRoleTokens = getUserRoleTokens({ role: row.role, roles: row.roles });
        if (
          voterRoleTokens.includes("community_moderator") ||
          voterRoleTokens.includes("community_leader")
        ) {
          eligibleVoters.add(String(row.voterId));
        }
      }

      const voteCount = eligibleVoters.size;

      let reportId: string | null = null;
      let status: string = "pending";
      if (voteCount >= COMMUNITY_CONFIRMATION_THRESHOLD) {
        // Create (or update) an escalated moderation report for staff review.
        const existingReports = await db
          .select()
          .from(moderationReports)
          .where(
            and(
              eq(moderationReports.contentType, "user_profile" as any),
              eq(moderationReports.contentId, targetUserId),
              sql`${moderationReports.status} in ('pending','under_review','escalated')`
            )
          )
          .orderBy(desc(moderationReports.createdAt))
          .limit(1);

        if (existingReports.length) {
          reportId = String((existingReports[0] as any).id);
          status = String((existingReports[0] as any).status || "escalated");
          await db
            .update(moderationReports)
            .set({
              status: "escalated" as any,
              totalVotes: voteCount,
              votesRequired: COMMUNITY_CONFIRMATION_THRESHOLD,
              additionalContext: sql`
                case
                  when ${moderationReports.additionalContext} is null then jsonb_build_object('kind','kick_vote','kickVoteCount',${voteCount})
                  when jsonb_typeof(${moderationReports.additionalContext}) = 'object' then ${moderationReports.additionalContext} || jsonb_build_object('kind','kick_vote','kickVoteCount',${voteCount})
                  else jsonb_build_object('kind','kick_vote','kickVoteCount',${voteCount})
                end
              ` as any,
              updatedAt: new Date(),
            } as any)
            .where(eq(moderationReports.id, reportId));
        } else {
          const inserted = await db
            .insert(moderationReports)
            .values({
              reporterId: voterId,
              contentType: "user_profile" as any,
              contentId: targetUserId,
              contentOwnerId: targetUserId,
              reason: "other" as any,
              description: `Kick-vote threshold reached (${voteCount}) - staff review required.`,
              status: "escalated" as any,
              totalVotes: voteCount,
              votesRequired: COMMUNITY_CONFIRMATION_THRESHOLD,
              additionalContext: { kind: "kick_vote", kickVoteCount: voteCount } as any,
            } as any)
            .returning({ id: moderationReports.id, status: moderationReports.status });

          reportId = inserted[0]?.id ? String(inserted[0].id) : null;
          status = inserted[0]?.status ? String(inserted[0].status) : "escalated";
        }

        if (reportId) {
          await db.insert(moderationActions).values({
            reportId,
            contentType: "user_profile" as any,
            contentId: targetUserId,
            contentOwnerId: targetUserId,
            action: "flagged" as any,
            actionBy: "community_vote" as any,
            reason: `Community kick-vote reached ${voteCount}`,
            isReversible: true,
          } as any);
        }
      }

      return res.json({
        success: true,
        voteCount,
        threshold: COMMUNITY_CONFIRMATION_THRESHOLD,
        reportId,
        status,
      });
    } catch (error) {
      console.error("Error processing kick vote:", error);
      return res.status(500).json({ error: "Failed to process kick vote" });
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
          // `hide` is a community-moderator confirmation signal; we recompute its eligible count below.
          hideCount = count;
          break;
      }
    });

    // Recompute hideCount as *eligible community confirmations* (community_moderator/community_leader/staff+).
    const hideVotes = await db
      .select({
        voterId: moderationVotes.voterId,
        role: users.role,
        roles: users.roles,
      })
      .from(moderationVotes)
      .leftJoin(users, eq(users.id, moderationVotes.voterId))
      .where(
        and(
          eq(moderationVotes.targetType, targetType),
          eq(moderationVotes.targetId, targetId),
          eq(moderationVotes.voteType, "hide"),
          eq(moderationVotes.isActive, true)
        )
      );

    const eligibleHideVoters = new Set<string>();
    for (const row of hideVotes as any[]) {
      if (!row?.voterId) continue;
      const voterRoleTokens = getUserRoleTokens({ role: row.role, roles: row.roles });
      if (
        voterRoleTokens.includes("community_moderator") ||
        voterRoleTokens.includes("community_leader") ||
        voterRoleTokens.includes("moderator") ||
        voterRoleTokens.includes("ops_admin") ||
        voterRoleTokens.includes("super_admin")
      ) {
        eligibleHideVoters.add(String(row.voterId));
      }
    }
    hideCount = eligibleHideVoters.size;

    // Calculate community score (weighted upvotes - weighted downvotes)
    const communityScore = Math.round((upvoteWeight - downvoteWeight) * 100) / 100;

    // Community-confirmation hide: 3 distinct eligible votes hides content and routes it to staff review.
    const isHidden = hideCount >= COMMUNITY_CONFIRMATION_THRESHOLD;

    // Auto-flag if flag count exceeds threshold (3 votes)
    const isFlagged = flagCount >= 3 || isHidden;

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

    // Apply community-hide to the underlying content record for community posts.
    // This makes the "event happen" (content is no longer served by default).
    if (isHidden && String(targetType).toLowerCase() === "post") {
      try {
        await db
          .update(communityPosts)
          .set({
            isHidden: true,
            moderatedBy: "community_vote",
            moderatedAt: new Date(),
            moderatorNotes: `Hidden by community confirmations (>=${COMMUNITY_CONFIRMATION_THRESHOLD})`,
            updatedAt: new Date(),
          } as any)
          .where(eq(communityPosts.id, String(targetId)));
      } catch (e) {
        // Fail-soft: moderation scores still capture hidden state even if post row is missing.
        console.warn("[moderation] failed to apply community hide to post", e);
      }
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
  // Staff+ can review moderation queues; ops/super have broader authority.
  const isStaffOrAbove = (user: any) =>
    hasAnyRole(user, ["moderator", "ops_admin", "super_admin"]) || user?.isAdmin === true;
  const isOpsOrAbove = (user: any) => hasAnyRole(user, ["ops_admin", "super_admin"]);

  // Get all flagged content for review
  app.get("/api/admin/moderation/flagged", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStaffOrAbove(req.user)) {
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
      if (!isStaffOrAbove(req.user)) {
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

  // Get recent moderation actions (hidden/removed items)
  app.get("/api/admin/moderation/recent-actions", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStaffOrAbove(req.user)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const actions = await db
        .select({
          id: moderationScores.id,
          targetType: moderationScores.targetType,
          targetId: moderationScores.targetId,
          flagCount: moderationScores.flagCount,
          hideCount: moderationScores.hideCount,
          isHidden: moderationScores.isHidden,
          isFlagged: moderationScores.isFlagged,
          updatedAt: moderationScores.updatedAt,
        })
        .from(moderationScores)
        .where(eq(moderationScores.isHidden, true))
        .orderBy(desc(moderationScores.updatedAt))
        .limit(20);

      res.json(actions || []);
    } catch (error) {
      console.error("Error fetching recent moderation actions:", error);
      res.status(500).json({ error: "Failed to fetch recent moderation actions" });
    }
  });

  // Approve flagged content (remove flag)
  app.post("/api/admin/moderation/approve/:contentId", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStaffOrAbove(req.user)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const { contentId } = req.params;
      const { targetType } = req.body;

      if (!contentId || !targetType) {
        return res.status(400).json({ error: "Missing contentId or targetType" });
      }

      // Reset flagged + hidden status (unhide if previously hidden by community confirmations)
      await db
        .update(moderationScores)
        .set({
          isFlagged: false,
          isHidden: false,
          updatedAt: new Date(),
        })
        .where(
          and(eq(moderationScores.targetId, contentId), eq(moderationScores.targetType, targetType))
        );

      if (String(targetType).toLowerCase() === "post") {
        await db
          .update(communityPosts)
          .set({
            isHidden: false,
            moderatedBy: String(req.user?.id || req.user?.claims?.sub || ""),
            moderatedAt: new Date(),
            moderatorNotes: "Approved by staff",
            updatedAt: new Date(),
          } as any)
          .where(eq(communityPosts.id, String(contentId)));
      }

      res.json({ success: true, message: "Content approved" });
    } catch (error) {
      console.error("Error approving content:", error);
      res.status(500).json({ error: "Failed to approve content" });
    }
  });

  // Remove flagged content
  app.post("/api/admin/moderation/remove/:contentId", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStaffOrAbove(req.user)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const { contentId } = req.params;
      const { targetType, reason } = req.body;

      if (!contentId || !targetType) {
        return res.status(400).json({ error: "Missing contentId or targetType" });
      }

      if (typeof reason !== "string" || reason.trim().length < 5) {
        return res
          .status(400)
          .json({ error: "Moderation reason is required and must be at least 5 characters" });
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

      await logAdminAction({
        type: "admin_moderation_remove",
        adminId: req.user?.id || req.user?.claims?.sub || "unknown",
        targetType: normalizedTargetType,
        targetId: contentId,
        reason: String(reason || ""),
      });

      res.json({ success: true, message: "Content removed" });
    } catch (error) {
      console.error("Error removing content:", error);
      res.status(500).json({ error: "Failed to remove content" });
    }
  });

  // Staff queue: community kick-vote escalations for user review.
  app.get("/api/admin/moderation/kick-queue", isAuthenticated, async (req: any, res) => {
    try {
      if (!isStaffOrAbove(req.user)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const rows = await db
        .select()
        .from(moderationReports)
        .where(
          and(
            eq(moderationReports.contentType, "user_profile" as any),
            eq(moderationReports.status, "escalated" as any)
          )
        )
        .orderBy(desc(moderationReports.updatedAt))
        .limit(100);

      const queue = (rows as any[]).filter((r) => {
        const ctx = r.additionalContext;
        return ctx && typeof ctx === "object" && (ctx as any).kind === "kick_vote";
      });

      res.json(queue);
    } catch (error) {
      console.error("Error fetching kick queue:", error);
      res.status(500).json({ error: "Failed to fetch kick queue" });
    }
  });

  app.post(
    "/api/admin/moderation/kick-queue/:reportId/decision",
    isAuthenticated,
    async (req: any, res) => {
      try {
        if (!isStaffOrAbove(req.user)) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        const reportId = String(req.params.reportId || "").trim();
        const decision = String((req.body as any)?.decision || "").trim();
        const notes = String((req.body as any)?.notes || "").trim();

        if (!reportId) return res.status(400).json({ error: "reportId is required" });
        if (!["no_action", "dismiss", "suspend", "recommend_ban", "warning"].includes(decision)) {
          return res.status(400).json({ error: "Invalid decision" });
        }

        const [report] = await db
          .select()
          .from(moderationReports)
          .where(eq(moderationReports.id, reportId))
          .limit(1);
        if (!report) return res.status(404).json({ error: "Report not found" });

        const targetUserId = String((report as any).contentId || "").trim();
        if (!targetUserId) return res.status(400).json({ error: "Invalid report contentId" });

        const staffUserId = req.user?.id || req.user?.claims?.sub || null;

        if (decision === "suspend") {
          // Suspend immediately (employee action). Ban remains ops-only.
          await db
            .update(users)
            .set({ verificationStatus: "suspended" as any, updatedAt: new Date() } as any)
            .where(eq(users.id, targetUserId));

          await db.insert(moderationActions).values({
            reportId,
            contentType: "user_profile" as any,
            contentId: targetUserId,
            contentOwnerId: targetUserId,
            action: "user_suspended" as any,
            actionBy: "moderator" as any,
            actionUserId: staffUserId,
            reason: notes || "Staff suspension after community kick-vote escalation",
            isReversible: true,
          } as any);
        }

        if (decision === "warning") {
          await db.insert(moderationActions).values({
            reportId,
            contentType: "user_profile" as any,
            contentId: targetUserId,
            contentOwnerId: targetUserId,
            action: "warning" as any,
            actionBy: "moderator" as any,
            actionUserId: staffUserId,
            reason: notes || "Staff warning after community kick-vote escalation",
            isReversible: true,
          } as any);
        }

        const nextStatus =
          decision === "dismiss"
            ? "dismissed"
            : decision === "recommend_ban"
              ? "escalated"
              : "resolved";

        const nextFinalAction =
          decision === "suspend"
            ? "user_suspended"
            : decision === "warning"
              ? "warning_issued"
              : decision === "recommend_ban"
                ? "content_flagged"
                : "no_action";

        await db
          .update(moderationReports)
          .set({
            status: nextStatus as any,
            finalAction: nextFinalAction as any,
            actionTakenBy: "moderator" as any,
            actionReason: notes || null,
            moderatorId: staffUserId,
            moderatorNotes: notes || null,
            updatedAt: new Date(),
            ...(nextStatus === "resolved" || nextStatus === "dismissed"
              ? { resolvedAt: new Date() }
              : {}),
          } as any)
          .where(eq(moderationReports.id, reportId));

        res.json({ success: true, status: nextStatus, decision });
      } catch (error) {
        console.error("Error processing staff kick decision:", error);
        res.status(500).json({ error: "Failed to process decision" });
      }
    }
  );

  app.post(
    "/api/admin/moderation/kick-queue/:reportId/ops-ban",
    isAuthenticated,
    async (req: any, res) => {
      try {
        if (!isOpsOrAbove(req.user)) {
          return res.status(403).json({ error: "Ops admin access required" });
        }

        const reportId = String(req.params.reportId || "").trim();
        const notes = String((req.body as any)?.notes || "").trim();
        if (!reportId) return res.status(400).json({ error: "reportId is required" });

        const [report] = await db
          .select()
          .from(moderationReports)
          .where(eq(moderationReports.id, reportId))
          .limit(1);
        if (!report) return res.status(404).json({ error: "Report not found" });

        const targetUserId = String((report as any).contentId || "").trim();
        if (!targetUserId) return res.status(400).json({ error: "Invalid report contentId" });

        const actorUserId = req.user?.id || req.user?.claims?.sub || null;

        // "Ban" is implemented as a hard suspension + durable marker in preferences (repo currently has no global is_banned flag on users).
        await db
          .update(users)
          .set({
            verificationStatus: "suspended" as any,
            preferences: sql`
            case
              when ${users.preferences} is null then jsonb_build_object('banStatus','banned','bannedAt',${new Date().toISOString()},'bannedBy',${String(actorUserId || "")},'bannedReason',${notes || "community escalation"})
              when jsonb_typeof(${users.preferences}) = 'object' then ${users.preferences} || jsonb_build_object('banStatus','banned','bannedAt',${new Date().toISOString()},'bannedBy',${String(actorUserId || "")},'bannedReason',${notes || "community escalation"})
              else jsonb_build_object('banStatus','banned','bannedAt',${new Date().toISOString()},'bannedBy',${String(actorUserId || "")},'bannedReason',${notes || "community escalation"})
            end
          ` as any,
            updatedAt: new Date(),
          } as any)
          .where(eq(users.id, targetUserId));

        await db.insert(moderationActions).values({
          reportId,
          contentType: "user_profile" as any,
          contentId: targetUserId,
          contentOwnerId: targetUserId,
          action: "user_banned" as any,
          actionBy: "admin" as any,
          actionUserId: actorUserId,
          reason: notes || "Ops ban after staff recommendation",
          isReversible: false,
        } as any);

        await db
          .update(moderationReports)
          .set({
            status: "resolved" as any,
            finalAction: "user_suspended" as any,
            actionTakenBy: "admin" as any,
            actionReason: notes || null,
            updatedAt: new Date(),
            resolvedAt: new Date(),
          } as any)
          .where(eq(moderationReports.id, reportId));

        res.json({ success: true });
      } catch (error) {
        console.error("Error processing ops ban:", error);
        res.status(500).json({ error: "Failed to ban user" });
      }
    }
  );
}
