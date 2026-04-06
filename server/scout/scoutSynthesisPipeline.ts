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
      ? "I can help with that. Your next best step is ready."
      : "I can help move this forward. Your next best step is ready.",
    provider: "fallback",
    intent: request.intent,
    suggestedActions: ["Route my next step"],
    degradationReason: "synthesis_pipeline_not_extracted",
  };
}
