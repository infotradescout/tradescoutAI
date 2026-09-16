export const SCOUT_REQUEST_UNCONFIRMED_MESSAGE =
  "Scout could not confirm this action. Check its current status before trying again.";

export type ScoutRequestCompletion = {
  requestId: string;
  status: string;
  to: string;
  acknowledgement: string;
  summary: string;
};

const REQUEST_STATUSES = new Set([
  "draft", "open", "routed", "in_progress", "pending_outcome", "completed", "cancelled",
]);

/** The create endpoint returns its persisted WorkRequest, not just authorization. */
export function resolveScoutRequestCompletion(
  value: unknown,
  fallbackCounty?: string | null
): ScoutRequestCompletion {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(SCOUT_REQUEST_UNCONFIRMED_MESSAGE);
  }
  const result = value as Record<string, unknown>;
  if (result.success === false || result.ok === false || result.executed === false ||
      result.verificationRequired === true || typeof result.id !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(result.id) ||
      typeof result.status !== "string" || !REQUEST_STATUSES.has(result.status)) {
    throw new Error(SCOUT_REQUEST_UNCONFIRMED_MESSAGE);
  }
  const params = new URLSearchParams({ selected: result.id, filter: "all" });
  const county = typeof result.countyFips === "string" ? result.countyFips : fallbackCounty;
  if (typeof county === "string" && /^\d{5}$/.test(county)) params.set("county", county);
  const isDraft = result.status === "draft";
  return {
    requestId: result.id,
    status: result.status,
    to: `/direct-connect/active?${params}`,
    acknowledgement: isDraft
      ? "Saved. Review your request before sharing."
      : "Your request is saved. Open it to review the current status.",
    summary: isDraft
      ? "This draft is saved. Review it before choosing to share it with providers."
      : "Open this saved request to review its current status and available next steps.",
  };
}
