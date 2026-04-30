import { inferSourceConfidenceBand, type SourceConfidenceBand } from "./scoutDeterministicHelpers";

type EnhancedV4DegradationReason = "enhanced_confidence_gate";

export interface EnhancedV4SourceAudit {
  sourceUsed: "classic_knowledge_pipeline" | "enhanced_v4";
  attemptedSource?: "enhanced_v4";
  fallbackUsed: boolean;
  degradationReason?: EnhancedV4DegradationReason;
  confidenceBand: SourceConfidenceBand;
}

export interface EnhancedV4ProxyDecision {
  useEnhancedResponse: boolean;
  message: string;
  rawConfidence: unknown;
  sourceAudit: EnhancedV4SourceAudit;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function assessEnhancedV4ProxyResponse(payload: unknown): EnhancedV4ProxyDecision {
  const root = readObject(payload);
  const synthesized = readObject(root.synthesized_response);
  const reflection = readObject(root.reflection);
  const rawConfidence = synthesized.confidence ?? reflection.confidence;
  const confidenceBand = inferSourceConfidenceBand(rawConfidence);
  const message = String(synthesized.message || root.message || "").trim() || "Scout is online.";

  if (confidenceBand !== "high") {
    return {
      useEnhancedResponse: false,
      message,
      rawConfidence,
      sourceAudit: {
        sourceUsed: "classic_knowledge_pipeline",
        attemptedSource: "enhanced_v4",
        fallbackUsed: true,
        degradationReason: "enhanced_confidence_gate",
        confidenceBand,
      },
    };
  }

  return {
    useEnhancedResponse: true,
    message,
    rawConfidence,
    sourceAudit: {
      sourceUsed: "enhanced_v4",
      fallbackUsed: false,
      confidenceBand,
    },
  };
}
