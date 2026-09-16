export const SCOUT_REQUEST_UNCONFIRMED_MESSAGE =
  "Scout could not confirm this action. Check its current status before trying again.";

export type ScoutRequestCompletion = {
  requestId: string;
  replayed: boolean;
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
      result.verificationRequired === true ||
      (result.idempotentReplay !== undefined && typeof result.idempotentReplay !== "boolean") ||
      typeof result.id !== "string" ||
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
    replayed: result.idempotentReplay === true,
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

type RequestApi = (method: string, url: string, payload: unknown) => Promise<unknown>;

type ScoutRequestPrerequisite = {
  verificationRequired: true;
  message: string;
  actions: Array<{ type: "NAVIGATE"; label: string; to: string }>;
};

/** Return only application-owned recovery instructions, never arbitrary error URLs. */
export function resolveScoutRequestPrerequisite(error: unknown): ScoutRequestPrerequisite | null {
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  const failure = error as Record<string, unknown>;
  const details = failure.details && typeof failure.details === "object" && !Array.isArray(failure.details)
    ? failure.details as Record<string, unknown> : {};
  if (failure.status === 401) {
    return {
      verificationRequired: true,
      message: "Sign in before creating this request. No request has been confirmed.",
      actions: [{ type: "NAVIGATE", label: "Sign in", to: "/pre-scout-setup?mode=signin&next=%2Fscout" }],
    };
  }
  if (failure.status !== 428) return null;
  if (typeof failure.code === "string" && typeof details.code === "string" && failure.code !== details.code) return null;
  const code = typeof failure.code === "string" ? failure.code : details.code;
  if (code === "PROFILE_BASICS_REQUIRED") {
    return {
      verificationRequired: true,
      message: "Complete your name, location, and contact information before posting this request. No request has been confirmed.",
      actions: [{ type: "NAVIGATE", label: "Complete profile information", to: "/profile-settings" }],
    };
  }
  if (code === "VERIFICATION_REQUIRED") {
    return {
      verificationRequired: true,
      message: "Complete the required verification before posting this request. No request has been confirmed.",
      actions: [{ type: "NAVIGATE", label: "Open verification", to: "/verification" }],
    };
  }
  return null;
}

/** One attempt only. Known prerequisite failures are guidance, never saved results. */
export async function submitScoutRequest(api: RequestApi, payload: unknown): Promise<unknown> {
  try {
    return await api("POST", "/api/direct-connect/requests", payload);
  } catch (error) {
    const prerequisite = resolveScoutRequestPrerequisite(error);
    if (prerequisite) return prerequisite;
    throw error;
  }
}
