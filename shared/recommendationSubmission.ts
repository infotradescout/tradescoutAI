import { z } from "zod";

const blankToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "") ? undefined : value;

const optionalSignal = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());

/** Content only. Account identity, verification and publication are server-owned. */
export const recommendationSubmissionSchema = z
  .object({
    submissionId: z.string().uuid("Please reopen your recommendation and try again."),
    recommendationType: z.enum(["positive", "negative"]),
    comment: z
      .string()
      .trim()
      .min(10, "Add at least 10 characters about your experience.")
      .max(4000),
    projectType: optionalSignal(z.string().trim().max(120)),
    projectValue: optionalSignal(
      z
        .union([
          z
            .string()
            .trim()
            .regex(/^\d+(?:\.\d{1,2})?$/),
          z.number().finite(),
        ])
        .transform(Number)
        .pipe(z.number().min(0).max(1_000_000_000))
        .transform((value) => value.toFixed(2))
    ),
    workQuality: optionalSignal(z.enum(["excellent", "good", "fair", "poor"])),
    timeliness: optionalSignal(z.enum(["on_time", "slightly_late", "very_late"])),
    communication: optionalSignal(z.enum(["excellent", "good", "fair", "poor"])),
    wouldHireAgain: optionalSignal(z.boolean()),
  })
  .strict();

export type RecommendationSubmission = z.infer<typeof recommendationSubmissionSchema>;

export type SavedRecommendation = RecommendationSubmission & {
  id: string;
  contractorId: string;
  moderationStatus: string;
  isPublic: boolean;
  isVerified: boolean;
  createdAt: Date | string | null;
};

export type RecommendationSaveResponse = {
  success: true;
  recommendation: SavedRecommendation | null;
  missingVerification: "email"[];
  message: string;
};
