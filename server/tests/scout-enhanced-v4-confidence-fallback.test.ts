import { describe, expect, it } from "vitest";
import { assessEnhancedV4ProxyResponse } from "../scout/scoutEnhancedV4Fallback";

describe("enhanced v4 confidence fallback contract", () => {
  it.each([
    ["low", "low"],
    ["medium", "medium"],
    [0.49, "low"],
    [0.79, "medium"],
    [undefined, "unknown"],
  ] as const)(
    "falls through to classic Scout when enhanced confidence is %s",
    (confidence, expectedBand) => {
      const result = assessEnhancedV4ProxyResponse({
        synthesized_response: {
          message: "Enhanced candidate response",
          confidence,
        },
      });

      expect(result.useEnhancedResponse).toBe(false);
      expect(result.message).toBe("Enhanced candidate response");
      expect(result.sourceAudit).toEqual({
        sourceUsed: "classic_knowledge_pipeline",
        attemptedSource: "enhanced_v4",
        fallbackUsed: true,
        degradationReason: "enhanced_confidence_gate",
        confidenceBand: expectedBand,
      });
    }
  );

  it("uses enhanced v4 only for high-confidence responses", () => {
    const result = assessEnhancedV4ProxyResponse({
      synthesized_response: {
        message: "High confidence agent council response",
        confidence: "high",
      },
    });

    expect(result.useEnhancedResponse).toBe(true);
    expect(result.message).toBe("High confidence agent council response");
    expect(result.sourceAudit).toEqual({
      sourceUsed: "enhanced_v4",
      fallbackUsed: false,
      confidenceBand: "high",
    });
  });

  it("reads reflection confidence when synthesized confidence is absent", () => {
    const result = assessEnhancedV4ProxyResponse({
      synthesized_response: {
        message: "Reflection-backed candidate",
      },
      reflection: {
        confidence: "medium",
      },
    });

    expect(result.useEnhancedResponse).toBe(false);
    expect(result.rawConfidence).toBe("medium");
    expect(result.sourceAudit.confidenceBand).toBe("medium");
    expect(result.sourceAudit.degradationReason).toBe("enhanced_confidence_gate");
  });
});
