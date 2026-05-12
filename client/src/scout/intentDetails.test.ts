import { describe, expect, it } from "vitest";
import {
  buildIntentDetailPrompts,
  formatIntentDetailChips,
  inferScoutIntentDetails,
} from "./intentDetails";

describe("Scout intent details", () => {
  it("infers visible user intent details without internal labels", () => {
    const detail = inferScoutIntentDetails("My AC is not cooling today", {
      countyName: "Tangipahoa Parish",
      stateCode: "LA",
    });

    expect(detail.need).toContain("AC is not cooling");
    expect(detail.area).toBe("Tangipahoa Parish");
    expect(detail.timing).toBe("today");
    expect(detail.context).toBe("home");
    expect(detail.missing).not.toContain("area");
  });

  it("asks for missing data users can actually provide", () => {
    const prompts = buildIntentDetailPrompts("Need help");

    expect(prompts.map((prompt) => prompt.label)).toContain("Add location");
    expect(prompts.map((prompt) => prompt.label)).toContain("Add timing");
    expect(prompts.map((prompt) => prompt.label)).toContain("Add home or project details");
  });

  it("formats collected details as plain-language chips", () => {
    const chips = formatIntentDetailChips(
      inferScoutIntentDetails("Brake noise on my truck asap under $500", {
        countyName: "Maricopa County",
      })
    );

    expect(chips.join(" | ")).toContain("Need:");
    expect(chips.join(" | ")).toContain("Area: Maricopa County");
    expect(chips.join(" | ")).toContain("When: asap");
    expect(chips.join(" | ")).toContain("Budget: up to $500");
    expect(chips.join(" | ")).toContain("Context: vehicle");
  });

  it("keeps client job context separate from personal project context", () => {
    const detail = inferScoutIntentDetails("I am a contractor building a deck for a client");
    const chips = formatIntentDetailChips(detail);

    expect(detail.context).toBe("home");
    expect(detail.perspective).toBe("client");
    expect(chips.join(" | ")).toContain("For: client job");
  });

  it("captures expectation signals without judging the user", () => {
    const detail = inferScoutIntentDetails("Need the best fence done right but budget is tight");
    const chips = formatIntentDetailChips(detail).join(" | ").toLowerCase();

    expect(detail.expectation).toBe("high-quality result");
    expect(chips).toContain("goal: high-quality result");
    expect(chips).not.toContain("unrealistic");
    expect(chips).not.toContain("feasible");
  });

  it("keeps supplier intake one tap away for material searches", () => {
    const prompts = buildIntentDetailPrompts("Need Lowe's lumber and fasteners for a deck");

    expect(prompts.map((prompt) => prompt.label)).toContain("Add material list or link");
  });
});
