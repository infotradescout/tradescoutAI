import { describe, expect, it } from "vitest";
import ScoutSituationAnalyzer, {
  type SituationAnalysisInput,
  type SituationEvent,
  type SituationObjective,
  type SituationUrgencySignal,
} from "../services/scoutSituationAnalyzer";
import { UnifiedScoutRouter, type UnifiedScoutUserContext } from "../services/unifiedScoutRouter";

const FIXED_NOW = new Date("2026-03-08T18:00:00.000Z");

function buildInput(overrides?: Partial<SituationAnalysisInput>): SituationAnalysisInput {
  return {
    intent: "find a local contractor for roof repair",
    userContext: {
      userId: "u-1",
      isAuthenticated: true,
      userRole: "homeowner",
      trustLevel: "medium",
      location: { county: "Harris", state: "TX" },
    },
    activeObjectives: [
      {
        id: "obj-1",
        title: "Roof repair quotes",
        intentClass: "work_request",
        status: "active",
        progressPct: 40,
        updatedAt: "2026-03-08T17:30:00.000Z",
      },
    ],
    recentEvents: [
      {
        type: "route_success",
        timestamp: "2026-03-08T16:00:00.000Z",
      },
      {
        type: "action_success",
        timestamp: "2026-03-08T16:30:00.000Z",
      },
    ],
    urgencySignals: [
      { source: "direct_user_signal", level: 2, observedAt: "2026-03-08T17:00:00.000Z" },
    ],
    now: FIXED_NOW,
    ...overrides,
  };
}

describe("ScoutSituationAnalyzer", () => {
  it("returns deterministic output for identical input", () => {
    const input = buildInput();
    const first = ScoutSituationAnalyzer.analyze(input);
    const second = ScoutSituationAnalyzer.analyze(input);

    expect(second.deterministicSignature).toBe(first.deterministicSignature);
    expect(second.contextScore).toBe(first.contextScore);
    expect(second.confidenceAdjustment).toBe(first.confidenceAdjustment);
    expect(second.recommendations).toEqual(first.recommendations);
  });

  it("produces factor breakdown with expected categories", () => {
    const result = ScoutSituationAnalyzer.analyze(buildInput());
    const factorIds = result.factors.map((f) => f.factor).sort();

    expect(factorIds).toEqual([
      "event_signal",
      "inactivity",
      "objective_momentum",
      "role_readiness",
      "trust",
      "urgency",
    ]);
    expect(result.factors.every((f) => f.weight > 0)).toBe(true);
  });

  it("classifies high urgency + failures as blocked", () => {
    const events: SituationEvent[] = [
      { type: "route_failure", timestamp: "2026-03-08T15:00:00.000Z" },
      { type: "action_failure", timestamp: "2026-03-08T15:30:00.000Z" },
      { type: "contact_blocked", timestamp: "2026-03-08T15:45:00.000Z" },
    ];
    const signals: SituationUrgencySignal[] = [
      { source: "deadline", level: 3, observedAt: "2026-03-08T17:00:00.000Z" },
    ];

    const result = ScoutSituationAnalyzer.analyze(
      buildInput({ recentEvents: events, urgencySignals: signals })
    );

    expect(result.stateTag).toBe("blocked");
    expect(result.confidenceAdjustment).toBeLessThan(0);
  });

  it("classifies stale objective as reengaging after 48h inactivity", () => {
    const objectives: SituationObjective[] = [
      {
        id: "obj-2",
        status: "active",
        progressPct: 15,
        updatedAt: "2026-03-05T12:00:00.000Z",
      },
    ];

    const result = ScoutSituationAnalyzer.analyze(
      buildInput({
        activeObjectives: objectives,
        recentEvents: [],
        urgencySignals: [],
      })
    );

    expect(result.stateTag).toBe("reengaging");
    expect(result.factors.find((f) => f.factor === "inactivity")?.raw).toBeLessThan(40);
  });

  it("builds direct-connect recommendation for work intents", () => {
    const result = ScoutSituationAnalyzer.analyze(
      buildInput({ intent: "need a contractor to fix roof leak today" })
    );
    const top = result.recommendations[0];

    expect(top.featureId).toBe("direct_connect");
    expect(top.action.to).toBe("/direct-connect");
    expect(top.confidence).toBeGreaterThan(0.7);
  });

  it("builds community-first recommendation for community intents", () => {
    const result = ScoutSituationAnalyzer.analyze(
      buildInput({
        intent: "help me post this in community and ask neighbors",
        activeObjectives: [
          {
            id: "obj-community",
            title: "Neighborhood update",
            intentClass: "community_post",
            status: "active",
            progressPct: 30,
            updatedAt: "2026-03-08T17:30:00.000Z",
          },
        ],
      })
    );

    expect(result.recommendations[0]?.featureId).toBe("community");
  });

  it("builds exchange recommendation for marketplace intent", () => {
    const result = ScoutSituationAnalyzer.analyze(
      buildInput({ intent: "i want to sell tools in the marketplace" })
    );

    const hasExchange = result.recommendations.some((r) => r.featureId === "exchange");
    expect(hasExchange).toBe(true);
  });

  it("applies adjustment to base confidence with clamped boundaries", () => {
    const high = ScoutSituationAnalyzer.analyze(buildInput());
    const lowered = ScoutSituationAnalyzer.analyze(
      buildInput({
        recentEvents: [
          { type: "route_failure", timestamp: "2026-03-08T16:00:00.000Z" },
          { type: "action_failure", timestamp: "2026-03-08T16:05:00.000Z" },
        ],
        urgencySignals: [{ source: "failed_action", level: 3 }],
      })
    );

    const boostedConfidence = ScoutSituationAnalyzer.applyAdjustment(0.7, high);
    const constrainedLow = ScoutSituationAnalyzer.applyAdjustment(0.03, lowered);

    expect(boostedConfidence).toBeGreaterThan(0.7);
    expect(constrainedLow).toBeGreaterThanOrEqual(0.01);
  });

  it("exposes confidence band boundaries for UI rendering", () => {
    expect(ScoutSituationAnalyzer.bandBoundaries("high")).toEqual({
      min: 0.76,
      max: 0.99,
      label: "High confidence",
    });
    expect(ScoutSituationAnalyzer.bandBoundaries("medium").min).toBe(0.46);
    expect(ScoutSituationAnalyzer.bandBoundaries("low").max).toBe(0.45);
  });

  it("degrades confidence when state is blocked", () => {
    const result = ScoutSituationAnalyzer.analyze(
      buildInput({
        recentEvents: [
          { type: "route_failure", timestamp: "2026-03-08T15:00:00.000Z" },
          { type: "action_failure", timestamp: "2026-03-08T15:05:00.000Z" },
        ],
        urgencySignals: [{ source: "failed_action", level: 3 }],
      })
    );

    const confidences = result.recommendations.map((r) => r.confidence);
    expect(result.stateTag).toBe("blocked");
    expect(Math.max(...confidences)).toBeLessThan(0.9);
  });
});

describe("UnifiedScoutRouter + situation integration", () => {
  const userContext: UnifiedScoutUserContext = {
    userId: "user-42",
    isAuthenticated: true,
    userRole: "homeowner",
    trustLevel: "high",
  };

  it("keeps behavior stable when no situation options are provided", () => {
    const result = UnifiedScoutRouter.resolveIntent("open direct connect", userContext);
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe(0.9);
    expect(result?.metadata?.situation).toBeUndefined();
  });

  it("embeds situation metadata and adjusted confidence when provided", () => {
    const result = UnifiedScoutRouter.resolveIntent("open direct connect", userContext, {
      situation: {
        activeObjectives: [
          {
            id: "obj-1",
            status: "active",
            progressPct: 80,
            updatedAt: "2026-03-08T17:59:00.000Z",
            intentClass: "work_request",
          },
        ],
        recentEvents: [{ type: "action_success", timestamp: "2026-03-08T17:45:00.000Z" }],
        urgencySignals: [{ source: "direct_user_signal", level: 2 }],
        now: FIXED_NOW,
      },
    });

    expect(result).not.toBeNull();
    expect(result?.metadata?.situation).toBeDefined();
    expect(result?.metadata?.confidenceBand).toMatch(/low|medium|high/);
    expect(result?.confidence).not.toBe(0.9);
    expect(typeof result?.metadata?.situation?.deterministicSignature).toBe("string");
  });

  it("marks risk as high when blocked state is inferred", () => {
    const result = UnifiedScoutRouter.resolveIntent("open direct connect", userContext, {
      situation: {
        activeObjectives: [
          {
            id: "obj-2",
            status: "active",
            updatedAt: "2026-03-05T00:00:00.000Z",
            progressPct: 20,
          },
        ],
        recentEvents: [
          { type: "route_failure", timestamp: "2026-03-08T15:00:00.000Z" },
          { type: "action_failure", timestamp: "2026-03-08T15:10:00.000Z" },
        ],
        urgencySignals: [{ source: "deadline", level: 3 }],
        now: FIXED_NOW,
      },
    });

    expect(result).not.toBeNull();
    expect(result?.metadata?.riskLevel).toBe("high");
  });
});

describe("ScoutSituationAnalyzer matrix coverage", () => {
  const roles = ["guest", "homeowner", "contractor", "realtor", "admin", "other"] as const;
  const intents = [
    "open direct connect for repairs",
    "show community activity",
    "sell tools in marketplace",
    "open maps near me",
    "property listing support",
    "start with scout and suggest next step",
  ];
  const urgencyLevels = [1, 2, 3] as const;

  const matrix = roles.flatMap((role) =>
    intents.flatMap((intent) =>
      urgencyLevels.map((level) => ({
        role,
        intent,
        level,
      }))
    )
  );

  it.each(matrix)(
    "returns bounded deterministic analysis for role=%s intent=%s urgency=%s",
    ({ role, intent, level }) => {
      const base = buildInput({
        intent,
        userContext: {
          userId: "matrix-user",
          isAuthenticated: role !== "guest",
          userRole: role,
          trustLevel: level === 3 ? "high" : level === 2 ? "medium" : "low",
        },
        urgencySignals: [{ source: "direct_user_signal", level }],
      });

      const result = ScoutSituationAnalyzer.analyze(base);
      const second = ScoutSituationAnalyzer.analyze(base);

      expect(result.contextScore).toBeGreaterThanOrEqual(0);
      expect(result.contextScore).toBeLessThanOrEqual(100);
      expect(result.confidenceAdjustment).toBeGreaterThanOrEqual(-0.2);
      expect(result.confidenceAdjustment).toBeLessThanOrEqual(0.2);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(second.deterministicSignature).toBe(result.deterministicSignature);
      expect(second.confidenceBand).toBe(result.confidenceBand);
    }
  );
});
