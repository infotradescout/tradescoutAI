import { describe, expect, it } from "vitest";
import { buildScoutProvenance } from "./provenance";

describe("buildScoutProvenance", () => {
  it("maps source, confidence, fallback, and authority metadata", () => {
    const provenance = buildScoutProvenance({
      metadata: {
        sourceUsed: "classic_knowledge_pipeline",
        attemptedSource: "enhanced_v4",
        fallbackUsed: true,
        confidenceBand: "medium",
        resolvedContext: {
          stage: "route_resolution",
          blockingReason: "auth_required",
          allowedActions: ["NAVIGATE", "ASK_SCOUT"],
        },
      },
      knowledge: {
        layer: 3,
        sources: [
          { title: "TradeScout Brain (data folder)" },
          { title: "Internet Search (Not Local TradeScout Data)" },
        ],
      },
    });

    expect(provenance?.sourceUsed).toBe("classic_knowledge_pipeline");
    expect(provenance?.attemptedSource).toBe("enhanced_v4");
    expect(provenance?.fallbackUsed).toBe(true);
    expect(provenance?.confidenceBand).toBe("medium");
    expect(provenance?.knowledgeLayer).toBe(3);
    expect(provenance?.sourceTitles).toEqual([
      "TradeScout Brain (data folder)",
      "Internet Search (Not Local TradeScout Data)",
    ]);
    expect(provenance?.resolvedStage).toBe("route_resolution");
    expect(provenance?.blockingReason).toBe("auth_required");
    expect(provenance?.allowedActions).toEqual(["NAVIGATE", "ASK_SCOUT"]);
  });

  it("normalizes missing structures to safe defaults", () => {
    const provenance = buildScoutProvenance({
      metadata: {},
      knowledge: {
        sources: [
          { type: "unknown" } as unknown as { title: string },
          null as unknown as { title: string },
        ],
      },
    });

    expect(provenance?.sourceTitles).toEqual([]);
    expect(provenance?.allowedActions).toEqual([]);
    expect(provenance?.blockingReason).toBeNull();
  });
});
