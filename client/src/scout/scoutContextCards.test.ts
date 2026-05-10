import { describe, expect, it } from "vitest";
import { buildScoutContextCards } from "./scoutContextCards";
import type { ScoutTileContext } from "./scoutActionTiles";

const baseContext: ScoutTileContext = {
  activeJobs: [],
  activeInvoices: [],
  savedContractors: [],
  homes: [],
  vehicles: [],
  recentActivity: [],
};

describe("buildScoutContextCards", () => {
  it("relates home searches to saved home context", () => {
    const cards = buildScoutContextCards(
      {
        ...baseContext,
        homes: [{ id: "h1", label: "Main house", city: "Pensacola", stateCode: "FL" }],
      },
      "AC not cooling"
    );

    expect(cards.some((card) => card.kind === "home" && card.label === "Main house")).toBe(true);
  });

  it("relates vehicle searches to saved vehicle context", () => {
    const cards = buildScoutContextCards(
      {
        ...baseContext,
        vehicles: [{ id: "v1", label: "2018 Ford F-150" }],
      },
      "brake repair"
    );

    expect(cards.some((card) => card.kind === "vehicle" && card.label === "2018 Ford F-150")).toBe(
      true
    );
  });

  it("keeps active project cards available for matching project work", () => {
    const cards = buildScoutContextCards(
      {
        ...baseContext,
        activeJobs: [{ id: "p1", name: "Roof repair", status: "active" }],
      },
      "roof quote"
    );

    expect(cards[0]?.kind).toBe("project");
    expect(cards[0]?.label).toContain("Roof repair");
  });

  it("does not surface invoice/payment actions unless the query asks for them", () => {
    const ctx: ScoutTileContext = {
      ...baseContext,
      activeInvoices: [{ id: "i1", jobName: "Roof repair", status: "pending" }],
    };

    expect(
      buildScoutContextCards(ctx, "roof repair").some((card) => card.id.includes("invoice"))
    ).toBe(false);
    expect(
      buildScoutContextCards(ctx, "pay roof invoice").some((card) => card.id.includes("invoice"))
    ).toBe(true);
  });

  it("relates material and supplier queries to Supply Run", () => {
    const cards = buildScoutContextCards(baseContext, "need lumber and concrete delivered");

    expect(cards.some((card) => card.id === "supply-run")).toBe(true);
  });

  it("provides both workspace and Scout actions for every card", () => {
    const cards = buildScoutContextCards(
      {
        ...baseContext,
        homes: [{ id: "h1", label: "Main house" }],
        vehicles: [{ id: "v1", label: "2018 Ford F-150" }],
        activeJobs: [{ id: "p1", name: "Roof repair", status: "active" }],
      },
      "roof repair"
    );

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.action.type).toBe("NAVIGATE");
      expect(card.prompt.length).toBeGreaterThan(10);
    }
  });
});
