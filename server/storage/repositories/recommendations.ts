import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, getTableColumns, gte, inArray, sql } from "drizzle-orm";
import {
  contractors,
  recommendations,
  users,
  type InsertRecommendation,
  type Recommendation,
} from "@shared/schema";
import { recommendationSubmissionSchema } from "@shared/recommendationSubmission";

export type RecommendationWriteInput = Pick<
  InsertRecommendation,
  | "id"
  | "contractorId"
  | "userId"
  | "recommendationType"
  | "comment"
  | "projectType"
  | "projectValue"
  | "workQuality"
  | "timeliness"
  | "communication"
  | "wouldHireAgain"
  | "ipAddress"
  | "userAgent"
>;

export class RecommendationSubmissionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "RecommendationSubmissionError";
  }
}

export function hasConfirmedRecommendationEmail(
  author:
    | { email?: string | null; emailVerified?: boolean | null; isActive?: boolean | null }
    | undefined
): boolean {
  return (
    author?.isActive !== false && author?.emailVerified === true && Boolean(author.email?.trim())
  );
}

export function withCurrentRecommendationVerification(
  recommendation: Recommendation,
  author: Parameters<typeof hasConfirmedRecommendationEmail>[0]
): Recommendation {
  const isVerified =
    hasConfirmedRecommendationEmail(author) &&
    recommendation.isVerified === true &&
    recommendation.customerEmail?.trim().toLowerCase() === author?.email?.trim().toLowerCase();
  return {
    ...recommendation,
    isVerified,
    isPublic:
      recommendation.isPublic === true &&
      recommendation.moderationStatus === "approved" &&
      isVerified,
  };
}

export const recommendationAuthorVerificationFields = {
  email: users.email,
  emailVerified: users.emailVerified,
  isActive: sql<boolean>`coalesce(to_jsonb(${users})->>'is_active', 'true') <> 'false'`,
};

const authorFields = {
  ...getTableColumns(users),
  ...recommendationAuthorVerificationFields,
};

// Public reads also check the current account: revoked confirmation or an email
// change must not leave stale stored evidence exposing a recommendation.
export const publicRecommendationConditions = () => [
  eq(recommendations.isPublic, true),
  eq(recommendations.moderationStatus, "approved"),
  eq(recommendations.isVerified, true),
  inArray(recommendations.recommendationType, ["positive", "negative"]),
  eq(users.emailVerified, true),
  sql`lower(trim(${users.email})) = lower(trim(${recommendations.customerEmail}))`,
  sql`length(trim(${users.email})) > 0`,
  sql`coalesce(to_jsonb(${users})->>'is_active', 'true') <> 'false'`,
];

const contentKeys = [
  "recommendationType",
  "comment",
  "projectType",
  "projectValue",
  "workQuality",
  "timeliness",
  "communication",
  "wouldHireAgain",
] as const;

// The server database is injected to allow real disposable PostgreSQL-compatible
// transaction tests without loading credentials or a production connection.
export function createRecommendationRepository(database: any) {
  const authorFor = async (tx: any, userId: string, mode: "share" | "update" = "share") => {
    const [author] = await tx
      .select(authorFields)
      .from(users)
      .where(eq(users.id, userId))
      .for(mode);
    if (!author) {
      throw new RecommendationSubmissionError(
        "Sign in to save your recommendation.",
        401,
        "AUTH_REQUIRED"
      );
    }
    return author;
  };

  const verificationFor = (author: any) => {
    const confirmed = hasConfirmedRecommendationEmail(author);
    return {
      customerEmail: String(author.email || "")
        .trim()
        .toLowerCase(),
      isVerified: confirmed,
      verificationMethod: confirmed ? "email" : null,
      verifiedAt: confirmed ? new Date() : null,
    };
  };

  const refreshStats = async (tx: any, contractorId: string) => {
    await tx.execute(sql`select refresh_contractor_recommendation_projection(${contractorId})`);
  };

  return {
    async create(data: RecommendationWriteInput): Promise<Recommendation> {
      const content = recommendationSubmissionSchema.parse({
        submissionId: data.id || randomUUID(),
        ...Object.fromEntries(contentKeys.map((key) => [key, data[key]])),
      });
      return database.transaction(async (tx: any) => {
        const author = await authorFor(tx, data.userId);
        const email = String(author.email || "")
          .trim()
          .toLowerCase();
        // Sorted transaction-scoped locks serialize all overlapping submission,
        // account/email duplicate windows and IP budgets across server processes.
        const lockKeys = [
          `recommendation:id:${content.submissionId}`,
          `recommendation:user:${data.userId}:${data.contractorId}`,
          ...(email ? [`recommendation:email:${email}:${data.contractorId}`] : []),
          ...(data.ipAddress ? [`recommendation:ip:${data.ipAddress}`] : []),
        ].sort();
        for (const key of lockKeys) {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
        }

        const [existing] = await tx
          .select()
          .from(recommendations)
          .where(eq(recommendations.id, content.submissionId));
        if (existing) {
          const sameContent = contentKeys.every((key) => {
            if (key === "projectValue" && existing[key] != null && content[key] != null) {
              return Number(existing[key]) === Number(content[key]);
            }
            return (existing[key] ?? null) === (content[key] ?? null);
          });
          if (
            existing.userId !== data.userId ||
            existing.contractorId !== data.contractorId ||
            !sameContent
          ) {
            throw new RecommendationSubmissionError(
              "This submission was already used. Reopen your recommendation and try again.",
              409,
              "SUBMISSION_CONFLICT"
            );
          }
          return existing;
        }

        const [contractor] = await tx
          .select()
          .from(contractors)
          .where(eq(contractors.id, data.contractorId))
          .for("update");
        if (!contractor) {
          throw new RecommendationSubmissionError(
            "This business is no longer available.",
            404,
            "BUSINESS_NOT_FOUND"
          );
        }
        if (contractor.userId === data.userId) {
          throw new RecommendationSubmissionError(
            "You cannot recommend your own business.",
            403,
            "SELF_RECOMMENDATION"
          );
        }

        const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [sameUser] = await tx
          .select({ id: recommendations.id })
          .from(recommendations)
          .where(
            and(
              eq(recommendations.contractorId, data.contractorId),
              eq(recommendations.userId, data.userId),
              gte(recommendations.createdAt, recent)
            )
          )
          .limit(1);
        if (sameUser) {
          throw new RecommendationSubmissionError(
            "You can submit one recommendation per business every 30 days. Your saved recommendation is still available.",
            409,
            "DUPLICATE_RECOMMENDATION"
          );
        }
        if (email) {
          const [sameEmail] = await tx
            .select({ id: recommendations.id })
            .from(recommendations)
            .where(
              and(
                eq(recommendations.contractorId, data.contractorId),
                sql`lower(trim(${recommendations.customerEmail})) = ${email}`,
                gte(recommendations.createdAt, recent)
              )
            )
            .limit(1);
          if (sameEmail) {
            throw new RecommendationSubmissionError(
              "This email already has a recommendation for this business in the last 30 days.",
              409,
              "DUPLICATE_RECOMMENDATION"
            );
          }
        }
        if (data.ipAddress) {
          const [recentIp] = await tx
            .select({ count: sql<number>`count(*)` })
            .from(recommendations)
            .where(
              and(
                eq(recommendations.ipAddress, data.ipAddress),
                gte(recommendations.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
              )
            );
          if (Number(recentIp?.count || 0) >= 5) {
            throw new RecommendationSubmissionError(
              "Too many recommendations from this location. Please try again tomorrow.",
              429,
              "RECOMMENDATION_RATE_LIMIT"
            );
          }
        }

        const { submissionId, ...signals } = content;
        const [created] = await tx
          .insert(recommendations)
          .values({
            ...signals,
            id: submissionId,
            contractorId: data.contractorId,
            userId: data.userId,
            customerName:
              [author.firstName, author.lastName].filter(Boolean).join(" ").trim() ||
              "TradeScout member",
            ...verificationFor(author),
            ipAddress: data.ipAddress || null,
            userAgent: data.userAgent || null,
            moderationStatus: "pending",
            isPublic: false,
          })
          .returning();
        return created;
      });
    },

    async verifyPendingForUser(userId: string) {
      return database.transaction(async (tx: any) => {
        const author = await authorFor(tx, userId, "update");
        const targets = await tx
          .selectDistinct({ id: recommendations.contractorId })
          .from(recommendations)
          .where(
            and(
              eq(recommendations.userId, userId),
              eq(recommendations.moderationStatus, "pending"),
              eq(recommendations.isPublic, false)
            )
          );
        if (targets.length) {
          await tx
            .select({ id: contractors.id })
            .from(contractors)
            .where(
              inArray(
                contractors.id,
                targets.map((target: { id: string }) => target.id)
              )
            )
            .orderBy(asc(contractors.id))
            .for("update");
        }
        await tx
          .update(recommendations)
          .set({ ...verificationFor(author), updatedAt: new Date() })
          .where(
            and(
              eq(recommendations.userId, userId),
              eq(recommendations.moderationStatus, "pending"),
              eq(recommendations.isPublic, false)
            )
          );
        return hasConfirmedRecommendationEmail(author);
      });
    },

    async mine(contractorId: string, userId: string) {
      const verified = await this.verifyPendingForUser(userId);
      const [result] = await database
        .select({ recommendation: recommendations, author: authorFields })
        .from(recommendations)
        .innerJoin(users, eq(users.id, recommendations.userId))
        .where(
          and(eq(recommendations.contractorId, contractorId), eq(recommendations.userId, userId))
        )
        .orderBy(desc(recommendations.createdAt))
        .limit(1);
      return {
        recommendation: result
          ? withCurrentRecommendationVerification(result.recommendation, result.author)
          : undefined,
        missingVerification: (result ? hasConfirmedRecommendationEmail(result.author) : verified)
          ? []
          : (["email"] as "email"[]),
      };
    },

    async listPublic(
      contractorId: string,
      options?: { limit?: number; type?: "positive" | "negative" | "all" }
    ): Promise<Recommendation[]> {
      const conditions = [
        eq(recommendations.contractorId, contractorId),
        ...publicRecommendationConditions(),
      ];
      if (options?.type && options.type !== "all")
        conditions.push(eq(recommendations.recommendationType, options.type));
      const rows = await database
        .select({ recommendation: recommendations })
        .from(recommendations)
        .innerJoin(users, eq(users.id, recommendations.userId))
        .where(and(...conditions))
        .orderBy(desc(recommendations.createdAt))
        .limit(Math.max(1, Math.min(options?.limit || 50, 100)));
      return rows.map((row: { recommendation: Recommendation }) => row.recommendation);
    },

    async moderate(id: string, action: "approve" | "reject", moderatorId: string) {
      return database.transaction(async (tx: any) => {
        const [target] = await tx.select().from(recommendations).where(eq(recommendations.id, id));
        if (!target)
          throw new RecommendationSubmissionError(
            "Recommendation not found.",
            404,
            "RECOMMENDATION_NOT_FOUND"
          );
        const [author] = await tx
          .select(authorFields)
          .from(users)
          .where(eq(users.id, target.userId))
          .for("share");
        // Lock the contractor before changing any recommendation so concurrent
        // moderation produces one coherent set of cached totals.
        const [contractor] = await tx
          .select()
          .from(contractors)
          .where(eq(contractors.id, target.contractorId))
          .for("update");
        if (!contractor)
          throw new RecommendationSubmissionError("Business not found.", 404, "BUSINESS_NOT_FOUND");
        const [recommendation] = await tx
          .select()
          .from(recommendations)
          .where(eq(recommendations.id, id))
          .for("update");
        if (!recommendation)
          throw new RecommendationSubmissionError(
            "Recommendation not found.",
            404,
            "RECOMMENDATION_NOT_FOUND"
          );
        if (
          action === "approve" &&
          !["positive", "negative"].includes(recommendation.recommendationType)
        ) {
          throw new RecommendationSubmissionError(
            "This older review needs an explicit recommendation choice before it can be published.",
            409,
            "LEGACY_RECOMMENDATION_REVIEW_REQUIRED"
          );
        }
        if (action === "approve" && !hasConfirmedRecommendationEmail(author)) {
          throw new RecommendationSubmissionError(
            "The author must confirm their email before this recommendation can be published.",
            409,
            "EMAIL_VERIFICATION_REQUIRED"
          );
        }
        if (action === "approve" && contractor.userId === recommendation.userId) {
          throw new RecommendationSubmissionError(
            "A business owner cannot recommend their own business.",
            403,
            "SELF_RECOMMENDATION"
          );
        }
        const [updated] = await tx
          .update(recommendations)
          .set({
            ...(action === "approve" ? verificationFor(author) : {}),
            moderationStatus: action === "approve" ? "approved" : "rejected",
            isPublic: action === "approve",
            moderatedAt: new Date(),
            moderatedBy: moderatorId,
            updatedAt: new Date(),
          })
          .where(eq(recommendations.id, id))
          .returning();
        await refreshStats(tx, recommendation.contractorId);
        return updated as Recommendation;
      });
    },

    async updateStats(contractorId: string) {
      return database.transaction(async (tx: any) => {
        await tx
          .select({ id: contractors.id })
          .from(contractors)
          .where(eq(contractors.id, contractorId))
          .for("update");
        await refreshStats(tx, contractorId);
      });
    },
  };
}
