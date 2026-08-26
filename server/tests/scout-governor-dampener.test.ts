import { describe, expect, it } from "vitest";
import {
  generateIntervention,
  selectAction,
  type Situation,
} from "../scout/governor";

function criticalSituation(confidence: number): Situation {
  return {
    goal: "Proceed with a high-stakes irreversible action",
    constraints: [],
    risks: [
      {
        type: "irreversible",
        severity: "critical",
        description: "Irreversible loss is possible",
        reversibility: "irreversible",
        consequences: ["Serious financial loss"],
      },
    ],
    unknowns: ["Verified authorization"],
    completedSteps: [],
    nextBestAction: null,
    confidence: "high",
    confidenceAssessment: {
      confidence,
      rawConfidence: confidence,
      signals: {
        evidenceStrength: 0.9,
        institutionalMemoryDensity: 0.5,
        userFamiliarity: 0.5,
        ambiguity: 0,
        outcomeRiskMagnitude: 1,
      },
      explanation: "test",
      allowedActions: ["DEFER", "REDIRECT", "BLOCK"],
    },
    authorityEvidence: {
      institutionalMemoryDensity: 0.5,
      approvedToolsForScope: 0,
      successes: 2,
      regrets: 0,
      recentSuccesses: 2,
      recentRegrets: 0,
    },
    local: null,
    temporal: null,
    financial: null,
    trust: null,
  };
}

describe("Scout confidence dampener policy", () => {
  it("allows BLOCK only when effective confidence remains at least 0.85", () => {
    const situation = criticalSituation(0.9);
    expect(
      selectAction(situation, {
        authorityMode: "normal",
        confidenceDampener: 1,
      }).action
    ).toBe("BLOCK");

    const damped = selectAction(situation, {
      authorityMode: "normal",
      confidenceDampener: 0.5,
    });
    expect(damped.effectiveConfidence).toBeCloseTo(0.45);
    expect(damped.action).toBe("DEFER");

    const stopped = selectAction(situation, {
      authorityMode: "normal",
      confidenceDampener: 0,
    });
    expect(stopped.effectiveConfidence).toBe(0);
    expect(stopped.action).toBe("DEFER");
  });

  it("clamps an amplifying multiplier and still requires authority proof", () => {
    const situation = criticalSituation(0.8);
    const result = selectAction(situation, {
      authorityMode: "normal",
      confidenceDampener: 2,
    });
    expect(result.effectiveConfidence).toBe(1);
    expect(result.action).toBe("BLOCK");

    situation.authorityEvidence = {
      institutionalMemoryDensity: 0,
      approvedToolsForScope: 0,
      successes: 0,
      regrets: 0,
      recentSuccesses: 0,
      recentRegrets: 0,
    };
    expect(
      selectAction(situation, {
        authorityMode: "normal",
        confidenceDampener: 2,
      }).action
    ).toBe("DEFER");
  });

  it("uses effective confidence for intervention tone", () => {
    const situation = criticalSituation(0.95);
    const intervention = generateIntervention(
      situation,
      "DEFER",
      "SAFEGUARD",
      null,
      { effectiveConfidence: 0.4 }
    );
    expect(intervention.userMessage).toContain(
      "I want to make sure you get the best outcome"
    );
    expect(intervention.userMessage).not.toContain("We need to pause here");
  });
});
