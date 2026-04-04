import type { NormalizedScoutRequest } from "../../shared/types/scout";

export type ScoutSynthesisResult = {
  message: string;
  intent?: string;
  provider?: string;
  suggestedActions?: string[];
  degradationReason?: string;
};

export function buildFallbackSynthesis(request: NormalizedScoutRequest): ScoutSynthesisResult {
  const hasQuestion = request.message.includes("?");
  return {
    message: hasQuestion
      ? "I can help with that. Want me to route your next best step now?"
      : "I can help move this forward. Want me to route your next best step now?",
    provider: "fallback",
    intent: request.intent,
    suggestedActions: ["Route my next step"],
    degradationReason: "synthesis_pipeline_not_extracted",
  };
}
