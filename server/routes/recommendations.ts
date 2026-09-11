import type { Express, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { contractors, recommendations, users, type Recommendation } from "@shared/schema";
import {
  recommendationSubmissionSchema,
  type RecommendationSaveResponse,
  type SavedRecommendation,
} from "@shared/recommendationSubmission";
import { isAuthenticated, requireRole } from "../auth";
import { db } from "../db";
import { storage } from "../storage";
import { toPublicContractorRecommendations } from "../publicContractorRecommendations";
import {
  hasConfirmedRecommendationEmail,
  RecommendationSubmissionError,
  withCurrentRecommendationVerification,
} from "../storage/repositories/recommendations";

const aliasSubmissionSchema = recommendationSubmissionSchema.extend({
  contractorId: z.string().trim().min(1).max(200),
});
const publicQuerySchema = z.object({
  type: z.enum(["positive", "negative", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

function savedRecommendation(row: Recommendation): SavedRecommendation {
  return {
    id: row.id,
    submissionId: row.id,
    contractorId: row.contractorId,
    recommendationType: row.recommendationType as "positive" | "negative",
    comment: row.comment,
    projectType: row.projectType || undefined,
    projectValue: row.projectValue || undefined,
    workQuality: (row.workQuality || undefined) as SavedRecommendation["workQuality"],
    timeliness: (row.timeliness || undefined) as SavedRecommendation["timeliness"],
    communication: (row.communication || undefined) as SavedRecommendation["communication"],
    wouldHireAgain: row.wouldHireAgain ?? undefined,
    moderationStatus: row.moderationStatus || "pending",
    isPublic: row.isPublic === true,
    isVerified: row.isVerified === true,
    createdAt: row.createdAt,
  };
}

function statusResponse(
  row: Recommendation | undefined,
  missingVerification: "email"[]
): RecommendationSaveResponse {
  const message = !row
    ? "Share your experience with this business."
    : row.moderationStatus === "rejected"
      ? "Your recommendation was not approved for publication."
      : missingVerification.length
        ? "Your recommendation is saved privately. Confirm your email so it can be reviewed for publication."
        : row.isPublic === true && row.moderationStatus === "approved"
          ? "Your recommendation is published."
          : "Your recommendation is saved and waiting for review. It will appear after approval.";
  return {
    success: true,
    recommendation: row ? savedRecommendation(row) : null,
    missingVerification,
    message,
  };
}

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof RecommendationSubmissionError) {
    return res
      .status(error.status)
      .json({ success: false, code: error.code, message: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ success: false, message: fallback });
}

function accountChanged(req: Request, userId: string, res: Response): boolean {
  const expected = req.get("X-Expected-Account-Id");
  if (!expected || expected === userId) return false;
  res.status(409).json({
    success: false,
    code: "ACCOUNT_CHANGED",
    message: "Your signed-in account changed. Refresh before continuing.",
  });
  return true;
}

export function registerRecommendationRoutes(app: Express) {
  const submit = async (req: Request, res: Response) => {
    const userId = (req.user as { id?: string } | undefined)?.id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Sign in to save your recommendation." });
    if (accountChanged(req, userId, res)) return;
    const parsed = req.params.contractorId
      ? recommendationSubmissionSchema.safeParse(req.body)
      : aliasSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Check your recommendation and try again.",
        errors: parsed.error.flatten(),
      });
    }
    const contractorId =
      req.params.contractorId ||
      (parsed.data as z.infer<typeof aliasSubmissionSchema>).contractorId;
    const {
      submissionId,
      recommendationType,
      comment,
      projectType,
      projectValue,
      workQuality,
      timeliness,
      communication,
      wouldHireAgain,
    } = parsed.data;
    try {
      const row = await storage.createRecommendation({
        id: submissionId,
        contractorId,
        userId,
        recommendationType,
        comment,
        projectType,
        projectValue,
        workQuality,
        timeliness,
        communication,
        wouldHireAgain,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get("User-Agent") || null,
      });
      const [author] = await db
        .select({ email: users.email, emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.id, userId));
      const missingVerification: "email"[] = hasConfirmedRecommendationEmail(author)
        ? []
        : ["email"];
      return res.json(
        statusResponse(withCurrentRecommendationVerification(row, author), missingVerification)
      );
    } catch (error) {
      return handleError(res, error, "Unable to save your recommendation. Please try again.");
    }
  };

  // A private saved recommendation needs only an account. Publication remains a
  // separate email-confirmation and moderation decision; onboarding is not a gate.
  app.post("/api/contractors/:contractorId/recommendations", isAuthenticated, submit);
  app.post("/api/recommendations", isAuthenticated, submit);

  app.get(
    "/api/contractors/:contractorId/recommendations/mine",
    isAuthenticated,
    async (req, res) => {
      const userId = (req.user as { id?: string } | undefined)?.id;
      if (!userId) return res.status(401).json({ message: "Sign in to view your recommendation." });
      if (accountChanged(req, userId, res)) return;
      try {
        const result = await storage.getMyContractorRecommendation(req.params.contractorId, userId);
        return res.json(statusResponse(result.recommendation, result.missingVerification));
      } catch (error) {
        return handleError(res, error, "Unable to load your saved recommendation.");
      }
    }
  );

  app.get("/api/contractors/:contractorId/recommendations", async (req, res) => {
    const parsed = publicQuerySchema.safeParse(req.query);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid recommendation filters." });
    try {
      const rows = await storage.getContractorRecommendations(req.params.contractorId, parsed.data);
      return res.json(toPublicContractorRecommendations(rows));
    } catch (error) {
      return handleError(res, error, "Unable to load recommendations.");
    }
  });

  app.get(
    "/api/admin/recommendations/pending",
    isAuthenticated,
    requireRole(["super_admin", "ops_admin", "moderator"]),
    async (req, res) => {
      const parsed = z.coerce.number().int().min(1).max(200).default(50).safeParse(req.query.limit);
      if (!parsed.success)
        return res.status(400).json({ message: "Invalid recommendation limit." });
      try {
        const rows = await db
          .select({
            id: recommendations.id,
            contractorId: recommendations.contractorId,
            recommendationType: recommendations.recommendationType,
            comment: recommendations.comment,
            customerName: recommendations.customerName,
            customerEmail: recommendations.customerEmail,
            projectType: recommendations.projectType,
            projectValue: recommendations.projectValue,
            createdAt: recommendations.createdAt,
            contractorName: contractors.companyName,
            authorEmail: users.email,
            authorEmailVerified: users.emailVerified,
          })
          .from(recommendations)
          .leftJoin(contractors, eq(recommendations.contractorId, contractors.id))
          .leftJoin(users, eq(recommendations.userId, users.id))
          .where(
            and(
              eq(recommendations.moderationStatus, "pending"),
              eq(recommendations.isPublic, false)
            )
          )
          .orderBy(desc(recommendations.createdAt))
          .limit(parsed.data);
        return res.json(
          rows.map(({ authorEmail, authorEmailVerified, ...row }: any) => ({
            ...row,
            missingVerification: hasConfirmedRecommendationEmail({
              email: authorEmail,
              emailVerified: authorEmailVerified,
            })
              ? []
              : ["email"],
          }))
        );
      } catch (error) {
        return handleError(res, error, "Unable to load pending recommendations.");
      }
    }
  );

  app.patch(
    "/api/admin/recommendations/:id/moderate",
    isAuthenticated,
    requireRole(["super_admin", "ops_admin", "moderator"]),
    async (req, res) => {
      const parsed = z
        .object({ action: z.enum(["approve", "reject"]) })
        .strict()
        .safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ message: "Action must be 'approve' or 'reject'." });
      const moderatorId = (req.user as { id?: string } | undefined)?.id;
      if (!moderatorId)
        return res.status(401).json({ message: "Sign in to moderate recommendations." });
      try {
        await storage.moderateContractorRecommendation(
          req.params.id,
          parsed.data.action,
          moderatorId
        );
        return res.json({
          success: true,
          message: `Recommendation ${parsed.data.action === "approve" ? "approved" : "rejected"}.`,
        });
      } catch (error) {
        return handleError(res, error, "Unable to moderate this recommendation.");
      }
    }
  );
}
