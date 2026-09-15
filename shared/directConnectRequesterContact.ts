/**
 * Requester-card presentation only. This is not a provider contact grant, a
 * delivery receipt, or permission to expose contact on public/share surfaces.
 * Actual contact reads and sends still validate the request and its recipient.
 */
export const DIRECT_CONNECT_REQUESTER_SUBMISSION_STATE = "request_submission" as const;

const OBSOLETE_REQUESTER_APPROVAL_STATES = new Set([
  "locked",
  "review_required",
  "request_shared",
  "contact_hidden",
  "contractor_requested",
  "provider_requested_contact",
  "user_approved",
  "requester_approved",
  "submission_consented",
]);

export function projectDirectConnectRequesterContactState(value: unknown): string {
  if (value != null && typeof value !== "string") return "unavailable";
  const state = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!state || OBSOLETE_REQUESTER_APPROVAL_STATES.has(state)) {
    return DIRECT_CONNECT_REQUESTER_SUBMISSION_STATE;
  }
  // Preserve explicit restrictions, historical released data and unknown states.
  // In particular, this projection never manufactures a released-contact state.
  return state;
}
