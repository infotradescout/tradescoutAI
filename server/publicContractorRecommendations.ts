import type { Recommendation } from "@shared/schema";

export type PublicContractorRecommendation = Pick<
  Recommendation,
  | "id"
  | "contractorId"
  | "recommendationType"
  | "comment"
  | "projectType"
  | "workQuality"
  | "timeliness"
  | "communication"
  | "wouldHireAgain"
  | "photoUrl"
  | "customerName"
  | "isVerified"
  | "verifiedAt"
  | "createdAt"
  | "updatedAt"
>;

/**
 * Public contractor pages may only show explicitly published, approved
 * recommendations. Verification evidence, contact details, request metadata,
 * and moderation internals never leave this boundary.
 */
export function toPublicContractorRecommendations(
  rows: Recommendation[] | null | undefined
): PublicContractorRecommendation[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row?.isPublic === true && row?.moderationStatus === "approved")
    .map((row) => ({
      id: row.id,
      contractorId: row.contractorId,
      recommendationType: row.recommendationType,
      comment: row.comment,
      projectType: row.projectType,
      workQuality: row.workQuality,
      timeliness: row.timeliness,
      communication: row.communication,
      wouldHireAgain: row.wouldHireAgain,
      photoUrl: row.photoUrl,
      customerName: row.customerName,
      isVerified: row.isVerified,
      verifiedAt: row.verifiedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
}
