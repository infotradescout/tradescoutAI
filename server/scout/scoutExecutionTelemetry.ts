export type ScoutExecutionTelemetry = {
  eventName: "scout_outcome_action_submitted" | "scout_outcome_action_replayed";
  executionId?: string;
};

/** Authorization, prose, failed acknowledgements and receipt replays are not new submissions. */
export function getScoutExecutionTelemetry(data: unknown): ScoutExecutionTelemetry | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const result = data as Record<string, unknown>;
  if (result.executed !== true || result.ok === false || result.success === false) return null;
  const executionId = typeof result.executionId === "string" &&
    /^[a-zA-Z0-9:_-]{16,128}$/.test(result.executionId) ? result.executionId : undefined;
  if (result.replayed === true && !executionId) return null;
  return {
    eventName: result.replayed === true
      ? "scout_outcome_action_replayed"
      : "scout_outcome_action_submitted",
    ...(executionId ? { executionId } : {}),
  };
}
