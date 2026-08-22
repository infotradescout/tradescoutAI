import { z } from "zod";

export const REVIEWABLE_BUSINESS_VERIFICATION_FIELDS = [
  "license",
  "insurance",
  "tax_id",
  "business_registration",
] as const;

export const businessVerificationFieldSchema = z.enum(REVIEWABLE_BUSINESS_VERIFICATION_FIELDS);

export type BusinessVerificationField = (typeof REVIEWABLE_BUSINESS_VERIFICATION_FIELDS)[number];
export type BusinessVerificationOverallStatus = "pending" | "approved" | "rejected";
export type BusinessVerificationFieldStatus =
  | "not_required"
  | "pending"
  | "submitted"
  | "approved"
  | "rejected";

export type VerificationRequirementsShape = Readonly<{
  email?: boolean;
  address?: boolean;
  license?: boolean;
  insurance?: boolean;
  tax_id?: boolean;
  business_registration?: boolean;
}>;

export type VerificationStatusShape = Readonly<{
  email?: boolean;
  address?: boolean;
  license?: boolean;
  insurance?: boolean;
  tax_id?: boolean;
  business_registration?: boolean;
}>;

export type FieldReviewMetadata = Readonly<{
  status: "submitted" | "approved" | "rejected";
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}>;

export type VerificationSubmissionsRecord = Record<string, unknown> & {
  licenseNumber?: string;
  licenseDocObjectKey?: string;
  taxIdLast4?: string;
  taxDocumentObjectKey?: string;
  insuranceDocObjectKey?: string;
  businessRegistrationDocObjectKey?: string;
  submittedAt?: string;
  fieldReview?: Partial<Record<BusinessVerificationField, FieldReviewMetadata>>;
};

const profileIdSchema = z.string().trim().min(1).max(128);
const privateObjectKeyInputSchema = z.string().trim().min(1).max(600);

export const profileVerificationSubmissionSchema = z
  .object({
    businessProfileId: profileIdSchema.optional(),
    licenseNumber: z.string().trim().min(2).max(120).optional(),
    licenseDocObjectKey: privateObjectKeyInputSchema.optional(),
    insuranceDocObjectKey: privateObjectKeyInputSchema.optional(),
    taxIdLast4: z
      .string()
      .regex(/^\d{4}$/, "Tax ID last four must be exactly four digits")
      .optional(),
    taxDocumentObjectKey: privateObjectKeyInputSchema.optional(),
    businessRegistrationDocObjectKey: privateObjectKeyInputSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      !value.licenseNumber &&
      !value.licenseDocObjectKey &&
      !value.insuranceDocObjectKey &&
      !value.taxIdLast4 &&
      !value.taxDocumentObjectKey &&
      !value.businessRegistrationDocObjectKey
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one verification value or document is required",
      });
    }
  });

export const adminBusinessVerificationDecisionSchema = z
  .object({
    field: businessVerificationFieldSchema,
    decision: z.enum(["approved", "rejected"]),
    rejectionReason: z.string().trim().min(12).max(1000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === "rejected" && !value.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejectionReason"],
        message: "A meaningful rejection reason is required",
      });
    }
  });

const PRIVATE_OBJECT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeOwnerSegment(userId: unknown): string {
  return String(userId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

export function isOwnedPrivateObjectKey(objectKey: unknown, userId: unknown): objectKey is string {
  if (typeof objectKey !== "string") return false;
  const owner = safeOwnerSegment(userId);
  if (!owner) return false;
  const parts = objectKey.trim().split("/");
  return (
    parts.length === 3 &&
    parts[0] === "private" &&
    parts[1] === owner &&
    PRIVATE_OBJECT_UUID.test(parts[2])
  );
}

export function selectOwnedVerificationProfile<
  T extends { id: unknown; userIntent?: unknown; isPrimary?: unknown; createdAt?: unknown },
>(profiles: readonly T[], requestedBusinessProfileId?: string): T | null {
  const ordered = [...profiles].sort((left, right) => {
    const leftTime = new Date(String(left.createdAt || "")).getTime();
    const rightTime = new Date(String(right.createdAt || "")).getTime();
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
    return leftTime - rightTime;
  });

  if (requestedBusinessProfileId) {
    return (
      ordered.find(
        (profile) =>
          String(profile.id) === requestedBusinessProfileId &&
          String(profile.userIntent) === "business"
      ) || null
    );
  }

  return (
    ordered.find(
      (profile) => String(profile.userIntent) === "business" && profile.isPrimary === true
    ) ||
    ordered.find((profile) => String(profile.userIntent) === "business") ||
    ordered.find((profile) => profile.isPrimary === true) ||
    ordered[0] ||
    null
  );
}

function cleanText(value: unknown, maxLength = 300): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function taxIdLastFour(submissions: VerificationSubmissionsRecord): string | null {
  const explicit = cleanText(submissions.taxIdLast4, 4);
  if (explicit && /^\d{4}$/.test(explicit)) return explicit;

  // Legacy rows may contain a full taxId. It is read only to derive a masked
  // last-four value and is never returned or persisted by this workflow.
  const legacyDigits = String(submissions.taxId || "").replace(/\D/g, "");
  return legacyDigits.length >= 4 ? legacyDigits.slice(-4) : null;
}

function hasDocument(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function sanitizeVerificationSubmissions(value: unknown) {
  const submissions =
    value && typeof value === "object"
      ? ({ ...(value as Record<string, unknown>) } as VerificationSubmissionsRecord)
      : ({} as VerificationSubmissionsRecord);

  return Object.freeze({
    licenseNumber: cleanText(submissions.licenseNumber, 120),
    taxIdLast4: taxIdLastFour(submissions),
    submittedAt: cleanText(submissions.submittedAt, 80),
    evidence: Object.freeze({
      licenseDocument: hasDocument(submissions.licenseDocObjectKey),
      insuranceDocument: hasDocument(submissions.insuranceDocObjectKey),
      taxDocument: hasDocument(submissions.taxDocumentObjectKey),
      businessRegistrationDocument: hasDocument(submissions.businessRegistrationDocObjectKey),
    }),
  });
}

function fieldReviewMap(
  value: unknown
): Partial<Record<BusinessVerificationField, FieldReviewMetadata>> {
  if (!value || typeof value !== "object") return {};
  const submissions = value as VerificationSubmissionsRecord;
  return submissions.fieldReview && typeof submissions.fieldReview === "object"
    ? { ...submissions.fieldReview }
    : {};
}

function fieldHasEvidence(
  submissions: VerificationSubmissionsRecord,
  field: BusinessVerificationField
): boolean {
  if (field === "license") {
    return (
      Boolean(cleanText(submissions.licenseNumber, 120)) ||
      hasDocument(submissions.licenseDocObjectKey)
    );
  }
  if (field === "insurance") return hasDocument(submissions.insuranceDocObjectKey);
  if (field === "tax_id") {
    return Boolean(taxIdLastFour(submissions)) || hasDocument(submissions.taxDocumentObjectKey);
  }
  return hasDocument(submissions.businessRegistrationDocObjectKey);
}

export function buildVerificationFieldReviewState(args: {
  requirements: VerificationRequirementsShape;
  status: VerificationStatusShape;
  submissions: unknown;
  includeReviewer?: boolean;
}) {
  const submissions =
    args.submissions && typeof args.submissions === "object"
      ? ({ ...(args.submissions as Record<string, unknown>) } as VerificationSubmissionsRecord)
      : ({} as VerificationSubmissionsRecord);
  const review = fieldReviewMap(submissions);
  const result: Record<
    string,
    {
      required: boolean;
      status: BusinessVerificationFieldStatus;
      submittedAt: string | null;
      reviewedAt: string | null;
      rejectionReason: string | null;
      reviewedBy?: string | null;
    }
  > = {};

  for (const field of ["email", "address"] as const) {
    const required = Boolean(args.requirements[field]);
    result[field] = {
      required,
      status: !required ? "not_required" : args.status[field] ? "approved" : "pending",
      submittedAt: null,
      reviewedAt: null,
      rejectionReason: null,
    };
  }

  for (const field of REVIEWABLE_BUSINESS_VERIFICATION_FIELDS) {
    const required = Boolean(args.requirements[field]);
    const metadata = review[field];
    let status: BusinessVerificationFieldStatus = "pending";
    if (!required) status = "not_required";
    else if (args.status[field]) status = "approved";
    else if (metadata?.status === "rejected") status = "rejected";
    else if (metadata?.status === "submitted" || fieldHasEvidence(submissions, field)) {
      status = "submitted";
    }

    result[field] = {
      required,
      status,
      submittedAt: cleanText(metadata?.submittedAt, 80),
      reviewedAt: cleanText(metadata?.reviewedAt, 80),
      rejectionReason: cleanText(metadata?.rejectionReason, 1000),
      ...(args.includeReviewer ? { reviewedBy: cleanText(metadata?.reviewedBy, 128) } : {}),
    };
  }

  return Object.freeze(result);
}

export function mergeVerificationSubmission(
  existingValue: unknown,
  input: z.infer<typeof profileVerificationSubmissionSchema>,
  submittedAt: string
): VerificationSubmissionsRecord {
  const next: VerificationSubmissionsRecord =
    existingValue && typeof existingValue === "object"
      ? ({ ...(existingValue as Record<string, unknown>) } as VerificationSubmissionsRecord)
      : {};
  delete next.taxId;

  if (input.licenseNumber) next.licenseNumber = input.licenseNumber;
  if (input.licenseDocObjectKey) next.licenseDocObjectKey = input.licenseDocObjectKey;
  if (input.insuranceDocObjectKey) next.insuranceDocObjectKey = input.insuranceDocObjectKey;
  if (input.taxIdLast4) next.taxIdLast4 = input.taxIdLast4;
  if (input.taxDocumentObjectKey) next.taxDocumentObjectKey = input.taxDocumentObjectKey;
  if (input.businessRegistrationDocObjectKey) {
    next.businessRegistrationDocObjectKey = input.businessRegistrationDocObjectKey;
  }

  const review = fieldReviewMap(next);
  const submittedFields: BusinessVerificationField[] = [];
  if (input.licenseNumber || input.licenseDocObjectKey) submittedFields.push("license");
  if (input.insuranceDocObjectKey) submittedFields.push("insurance");
  if (input.taxIdLast4 || input.taxDocumentObjectKey) submittedFields.push("tax_id");
  if (input.businessRegistrationDocObjectKey) submittedFields.push("business_registration");

  for (const field of submittedFields) {
    review[field] = Object.freeze({ status: "submitted", submittedAt });
  }
  next.fieldReview = review;
  next.submittedAt = submittedAt;
  return next;
}

export function recordVerificationDecision(args: {
  submissions: unknown;
  field: BusinessVerificationField;
  decision: "approved" | "rejected";
  reviewerId: string;
  reviewedAt: string;
  rejectionReason?: string;
}): VerificationSubmissionsRecord {
  const next: VerificationSubmissionsRecord =
    args.submissions && typeof args.submissions === "object"
      ? ({ ...(args.submissions as Record<string, unknown>) } as VerificationSubmissionsRecord)
      : {};
  delete next.taxId;
  const review = fieldReviewMap(next);
  const previous = review[args.field];
  review[args.field] = Object.freeze({
    status: args.decision,
    submittedAt: previous?.submittedAt || cleanText(next.submittedAt, 80) || undefined,
    reviewedAt: args.reviewedAt,
    reviewedBy: args.reviewerId,
    ...(args.decision === "rejected" ? { rejectionReason: args.rejectionReason } : {}),
  });
  next.fieldReview = review;
  return next;
}

export function deriveOverallBusinessVerificationStatus(args: {
  requirements: VerificationRequirementsShape;
  fieldReviewState: Readonly<Record<string, { status: BusinessVerificationFieldStatus }>>;
}): BusinessVerificationOverallStatus {
  const requiredFields = REVIEWABLE_BUSINESS_VERIFICATION_FIELDS.filter((field) =>
    Boolean(args.requirements[field])
  );
  if (requiredFields.length === 0) return "pending";
  if (requiredFields.some((field) => args.fieldReviewState[field]?.status === "rejected")) {
    return "rejected";
  }
  if (requiredFields.every((field) => args.fieldReviewState[field]?.status === "approved")) {
    return "approved";
  }
  return "pending";
}

export function getStoredVerificationDocumentKey(
  submissionsValue: unknown,
  field: BusinessVerificationField
): string | null {
  if (!submissionsValue || typeof submissionsValue !== "object") return null;
  const submissions = submissionsValue as VerificationSubmissionsRecord;
  const value =
    field === "license"
      ? submissions.licenseDocObjectKey
      : field === "insurance"
        ? submissions.insuranceDocObjectKey
        : field === "tax_id"
          ? submissions.taxDocumentObjectKey
          : submissions.businessRegistrationDocObjectKey;
  return cleanText(value, 600);
}
