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
      inferScoutIntentDetails("Brake noise on my truck asap", { countyName: "Maricopa County" })
    );

    expect(chips.join(" | ")).toContain("Need:");
    expect(chips.join(" | ")).toContain("Area: Maricopa County");
    expect(chips.join(" | ")).toContain("Timing: asap");
    expect(chips.join(" | ")).toContain("Context: vehicle");
  });
});
