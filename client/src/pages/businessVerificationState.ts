export type BusinessVerificationField =
  | "business_registration"
  | "license"
  | "insurance"
  | "tax_id";

export type BusinessVerificationReviewState =
  | "not_required"
  | "pending"
  | "submitted"
  | "approved"
  | "rejected";

export type BusinessVerificationFieldResolution = Readonly<{
  required: boolean;
  state: BusinessVerificationReviewState;
  actionable: boolean;
  rejectionReason: string;
}>;

export function normalizeBusinessVerificationReviewState(
  value: unknown
): BusinessVerificationReviewState {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "not_required") return "not_required";
  if (normalized === "approved" || normalized === "verified" || normalized === "complete") {
    return "approved";
  }
  if (normalized === "rejected" || normalized === "denied" || normalized === "changes_required") {
    return "rejected";
  }
  if (normalized === "submitted" || normalized === "under_review") return "submitted";
  return "pending";
}

export function resolveBusinessVerificationFieldState(args: {
  required: boolean;
  status: unknown;
  hasEvidence: boolean;
  rejectionReason?: unknown;
}): BusinessVerificationFieldResolution {
  const rejectionReason = String(args.rejectionReason || "").trim();
  if (!args.required) {
    return { required: false, state: "not_required", actionable: false, rejectionReason: "" };
  }

  const state = normalizeBusinessVerificationReviewState(args.status);
  if (state === "approved") {
    return { required: true, state: "approved", actionable: false, rejectionReason: "" };
  }
  if (state === "rejected") {
    return { required: true, state: "rejected", actionable: true, rejectionReason };
  }
  if (state === "submitted" || (state === "pending" && args.hasEvidence)) {
    return { required: true, state: "submitted", actionable: false, rejectionReason: "" };
  }
  return { required: true, state: "pending", actionable: true, rejectionReason: "" };
}

export function hasActionableBusinessVerificationFields(
  fields: readonly BusinessVerificationFieldResolution[]
): boolean {
  return fields.some((field) => field.required && field.actionable);
}
