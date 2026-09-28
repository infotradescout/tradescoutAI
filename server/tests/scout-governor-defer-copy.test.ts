import { describe, expect, it } from "vitest";
import { generateIntervention, type Situation } from "../scout/governor";

describe("Scout governor deferral copy", () => {
  it("asks for context without claiming information is missing when no unknowns were identified", () => {
    const situation: Situation = {
      goal: "electrical",
      constraints: [],
      risks: [],
      unknowns: [],
      completedSteps: [],
      nextBestAction: null,
      confidence: "low",
      local: null,
      temporal: null,
      financial: null,
      trust: null,
    };
    const intervention = generateIntervention(situation, "DEFER", "SAFEGUARD", null, {
      allowOverride: true,
    });

    expect(intervention.action).toBe("DEFER");
    expect(intervention.userMessage).toContain("What would you like Scout to find or help you decide?");
    expect(intervention.userMessage).not.toMatch(/0 pieces|institutional proof/i);
    expect(intervention.reasoning).not.toContain("Missing critical information");
  });
});
