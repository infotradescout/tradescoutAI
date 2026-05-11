import { describe, expect, it } from "vitest";
import {
  buildScoutLearningCluster,
  mergeScoutLearningSignal,
  optionBudgetForConfidence,
} from "./scoutLearningOptions";

describe("Scout learning options", () => {
  it("uses confidence to control how many follow-up paths are shown", () => {
    expect(optionBudgetForConfidence("low")).toBeGreaterThan(optionBudgetForConfidence("medium"));
    expect(optionBudgetForConfidence("medium")).toBeGreaterThan(optionBudgetForConfidence("high"));
  });

  it("preloads broad one-tap paths when Scout has low certainty", () => {
    const cluster = buildScoutLearningCluster({
      message: "I need help with a project",
      confidenceBand: "low",
      intentDetails: { missing: ["timing", "context"], need: "project" },
    });

    expect(cluster?.title).toBe("Make this fit you");
    expect(cluster?.actions?.map((action) => action.label)).toEqual([
      "This is for my home",
      "This is for a client",
      "Find local help",
      "Check prices",
      "Start a material run",
    ]);
  });

  it("keeps high-certainty follow-up options tighter", () => {
    const cluster = buildScoutLearningCluster({
      message: "Find a roofer",
      confidenceBand: "high",
      intentDetails: { context: "home", perspective: "self", missing: [] },
    });

    expect(cluster?.actions?.length).toBe(2);
  });

  it("preloads supplier, product, marketplace, and material-run paths for material needs", () => {
    const cluster = buildScoutLearningCluster({
      message: "Need lumber and fasteners for a deck",
      confidenceBand: "low",
      intentDetails: { context: "materials", missing: ["perspective"] },
    });

    expect(cluster?.actions?.map((action) => action.label)).toEqual([
      "This is for my home",
      "This is for a client",
      "Local suppliers",
      "Products to compare",
      "Exchange materials",
    ]);
    expect(JSON.stringify(cluster).toLowerCase()).toContain(
      "nothing is sent, posted, ordered, or paid"
    );
  });

  it("turns taps into learning counts without exposing internal labels", () => {
    const next = mergeScoutLearningSignal(
      { signals: {}, lastSignals: [] },
      {
        key: "perspective.client",
        label: "Client job",
        value: "client",
        source: "followup_option",
      }
    );

    expect(next.signals["perspective.client"]).toBe(1);
    expect(next.lastSignals).toEqual(["perspective.client"]);
  });
});
