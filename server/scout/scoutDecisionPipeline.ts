import type { NormalizedScoutRequest, ScoutDecision } from "../../shared/types/scout";

export function runScoutDecisionPipeline(request: NormalizedScoutRequest): ScoutDecision {
  if (!request.message) {
    return {
      type: "blocked",
      reason: "missing_message",
      requiresAuth: false,
      metadata: { stage: "decision_pipeline" },
    };
  }

  return {
    type: "synthesis_required",
    metadata: { stage: "decision_pipeline" },
  };
}
