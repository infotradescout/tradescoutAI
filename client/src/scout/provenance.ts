import type { ScoutBackendResponse } from "./api";
import type { ScoutMessage } from "./state";

export function buildScoutProvenance(
  response: Pick<ScoutBackendResponse, "metadata" | "knowledge">
): ScoutMessage["provenance"] {
  return {
    sourceUsed: response.metadata?.sourceUsed,
    attemptedSource: response.metadata?.attemptedSource,
    fallbackUsed: response.metadata?.fallbackUsed,
    confidenceBand: response.metadata?.confidenceBand,
    knowledgeLayer: response.knowledge?.layer,
    sourceTitles: Array.isArray(response.knowledge?.sources)
      ? response.knowledge.sources
          .map((source) => {
            if (!source) return "";
            if (typeof source === "string") return source;
            if (typeof source.title === "string") return source.title;
            return "";
          })
          .filter((value) => value.length > 0)
      : [],
    resolvedStage: response.metadata?.resolvedContext?.stage,
    blockingReason: response.metadata?.resolvedContext?.blockingReason ?? null,
    allowedActions: Array.isArray(response.metadata?.resolvedContext?.allowedActions)
      ? response.metadata?.resolvedContext?.allowedActions
      : [],
  };
}
