import { describe, expect, it } from "vitest";
import ScoutToneAwareBuilder from "../services/scoutToneAwareBuilder";

describe("ScoutToneAwareBuilder", () => {
  it("wraps technical fallback into local-action tone", () => {
    const wrapped = ScoutToneAwareBuilder.wrapTechnicalFallback(
      "Unable to process your request due to system failure.",
      "Harris County"
    );

    expect(wrapped.toLowerCase()).toContain("quick reset");
    expect(wrapped.toLowerCase()).toContain("harris county");
    expect(wrapped.toLowerCase()).toContain("opening one clear next step now");
    expect(wrapped.toLowerCase()).not.toContain("routing");
  });

  it("builds message with community tone metadata", () => {
    const result = ScoutToneAwareBuilder.build({
      scenario: "default",
      message: "Open Direct Connect for roofing estimates.",
      countyLabel: "Travis County",
      confidenceBand: "high",
      includeNextStep: true,
      nextStepLabel: "Open Direct Connect",
      nextStepRoute: "/direct-connect",
    });

    expect(result.metadata.localityPhrase.toLowerCase()).toContain("travis county");
    expect(result.message.toLowerCase()).toContain("visible and accountable");
    expect(result.message.toLowerCase()).toContain("next step");
  });

  it("removes robotic phrases through guardrails", () => {
    const result = ScoutToneAwareBuilder.build({
      scenario: "default",
      message: "As an AI, I can help with that and unable to process your request.",
    });

    expect(result.message.toLowerCase()).not.toContain("as an ai");
    expect(result.message.toLowerCase()).not.toContain("i can help with that");
    expect(result.guardrailFlags).toContain("robotic_phrase_removed");
  });

  it("rewrites overclaim language", () => {
    const result = ScoutToneAwareBuilder.build({
      scenario: "default",
      message: "This is definitely correct and everyone agrees.",
    });

    expect(result.message.toLowerCase()).not.toContain("definitely correct");
    expect(result.message.toLowerCase()).toContain("local people may see different outcomes");
    expect(result.guardrailFlags).toContain("overclaim_rewritten");
  });

  it("ensures human-feel question for non-blocked scenarios", () => {
    const result = ScoutToneAwareBuilder.build({
      scenario: "confidence_low",
      message: "Signal confidence is low",
    });

    expect(result.message.toLowerCase()).toContain("next step is ready now");
  });

  it("keeps blocked_action from forced question append", () => {
    const result = ScoutToneAwareBuilder.build({
      scenario: "blocked_action",
      message: "This action is currently gated.",
    });

    expect(result.message.endsWith("?")).toBe(false);
  });

  it("caps message length for verbose inputs", () => {
    const longText = "word ".repeat(300);
    const result = ScoutToneAwareBuilder.build({
      scenario: "default",
      message: longText,
    });

    expect(result.message.length).toBeLessThanOrEqual(360);
  });

  it("provides scenario templates", () => {
    expect(ScoutToneAwareBuilder.templateForScenario("technical_fallback")).toContain(
      "temporary issue"
    );
    expect(ScoutToneAwareBuilder.templateForScenario("confidence_low")).toContain("verify");
    expect(ScoutToneAwareBuilder.templateForScenario("blocked_action")).toContain("gated");
  });

  it("scores strong tone messages higher than robotic ones", () => {
    const strong = ScoutToneAwareBuilder.evaluateToneConsistency(
      "Keep this visible and accountable, not anonymous with people in your area. Next step is ready now."
    );
    const weak = ScoutToneAwareBuilder.evaluateToneConsistency(
      "As an AI system failure occurred and unable to process your request."
    );

    expect(strong).toBeGreaterThan(weak);
  });

  it("returns deterministic output for identical inputs", () => {
    const input = {
      scenario: "next_step_prompt" as const,
      message: "Open community and continue.",
      countyLabel: "Dane County",
      confidenceBand: "medium" as const,
      includeNextStep: true,
      nextStepLabel: "Open Community",
      nextStepRoute: "/community",
    };

    const first = ScoutToneAwareBuilder.build(input);
    const second = ScoutToneAwareBuilder.build(input);

    expect(second.message).toBe(first.message);
    expect(second.toneScore).toBe(first.toneScore);
    expect(second.guardrailFlags).toEqual(first.guardrailFlags);
  });

  it("injects next-step prompt metadata", () => {
    const result = ScoutToneAwareBuilder.build({
      scenario: "next_step_prompt",
      message: "Let's keep moving",
      nextStepLabel: "Open Exchange",
      nextStepRoute: "/exchange",
      includeNextStep: true,
    });

    expect(result.metadata.includesNextStep).toBe(true);
    expect(result.message.toLowerCase()).toContain("open exchange");
  });

  it("handles empty messages safely", () => {
    const result = ScoutToneAwareBuilder.build({
      scenario: "default",
      message: "",
    });

    expect(result.message.length).toBeGreaterThan(10);
    expect(result.toneScore).toBeGreaterThanOrEqual(0);
  });

  it("creates low-confidence message with verification emphasis", () => {
    const result = ScoutToneAwareBuilder.build({
      scenario: "confidence_low",
      message: "Confidence is still forming.",
      confidenceBand: "low",
      countyLabel: "Cook County",
    });

    expect(result.message.toLowerCase()).toContain("verify signals locally");
    expect(result.message.toLowerCase()).toContain("cook county");
  });

  it("adds transparency phrases in all scenarios", () => {
    const scenarios = [
      "default",
      "technical_fallback",
      "confidence_low",
      "blocked_action",
      "next_step_prompt",
    ] as const;

    for (const scenario of scenarios) {
      const result = ScoutToneAwareBuilder.build({
        scenario,
        message: "Move forward with a local plan.",
      });
      expect(result.message.toLowerCase()).toContain("out in the open");
    }
  });
});

describe("ScoutToneAwareBuilder matrix coverage", () => {
  const scenarios = [
    "default",
    "technical_fallback",
    "confidence_low",
    "blocked_action",
    "next_step_prompt",
  ] as const;
  const bands: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
  const messages = [
    "Need a local next step.",
    "As an AI system failure occurred.",
    "Everyone agrees this is definitely correct.",
  ];
  const counties = ["Harris County", "Cook County"] as const;
  const includeNextStep = [true, false] as const;

  const matrix = scenarios.flatMap((scenario) =>
    bands.flatMap((confidenceBand) =>
      messages.flatMap((message) =>
        counties.flatMap((countyLabel) =>
          includeNextStep.map((nextStep) => ({
            scenario,
            confidenceBand,
            message,
            countyLabel,
            nextStep,
          }))
        )
      )
    )
  );

  it.each(matrix)(
    "builds guarded message for scenario=%s band=%s",
    ({ scenario, confidenceBand, message, countyLabel, nextStep }) => {
      const result = ScoutToneAwareBuilder.build({
        scenario,
        message,
        countyLabel,
        confidenceBand,
        includeNextStep: nextStep,
        nextStepLabel: "Open Direct Connect",
        nextStepRoute: "/direct-connect",
      });

      expect(result.message.length).toBeGreaterThan(10);
      expect(result.message.length).toBeLessThanOrEqual(360);
      expect(result.toneScore).toBeGreaterThanOrEqual(0);
      expect(result.toneScore).toBeLessThanOrEqual(100);
      expect(result.message.toLowerCase()).toContain("out in the open");
    }
  );
});
