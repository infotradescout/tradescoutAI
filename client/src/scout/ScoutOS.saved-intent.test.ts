// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { inferSavedThreadIntent } from "./ScoutOS";
import type { ScoutMessage } from "./state";

describe("saved Scout task intent", () => {
  it("keeps a county posts and deals result in local discovery after autosave", () => {
    const messages: ScoutMessage[] = [
      {
        id: "u_local",
        role: "user",
        content: "Search TradeScout and my area for posts & deals in my county this week.",
      },
      {
        id: "a_local",
        role: "assistant",
        content: "One published county post; deals and other requested surfaces are not verified.",
        navTarget: "/community-feed?geo=local&feed=recent",
        provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
      },
    ];

    expect(inferSavedThreadIntent(messages)).toEqual({
      intent: "local_help",
      relatedLabel: "Local discovery",
      relatedPath: "/community-feed?geo=local&feed=recent",
    });
  });

  it("still sends genuine estimate work to Prices", () => {
    const messages: ScoutMessage[] = [
      { id: "u_price", role: "user", content: "Estimate the cost of a new fence." },
      { id: "a_price", role: "assistant", content: "I can help estimate the cost." },
    ];

    expect(inferSavedThreadIntent(messages)).toEqual({
      intent: "prices",
      relatedLabel: "Prices",
      relatedPath: "/finances/materials",
    });
  });

  it("uses the latest user turn when the conversation changes topics", () => {
    const priorLocalTurn: ScoutMessage[] = [
      { id: "u_old", role: "user", content: "Find posts and deals in my county." },
      {
        id: "a_old",
        role: "assistant",
        content: "One county post; deals unverified.",
        navTarget: "/community-feed?geo=local&feed=recent",
        provenance: { sourceUsed: "scout_mixed_discovery_recovery" },
      },
    ];

    expect(
      inferSavedThreadIntent([
        ...priorLocalTurn,
        { id: "u_new_price", role: "user", content: "Estimate the cost of a new fence." },
        { id: "a_new_price", role: "assistant", content: "Here is the estimate." },
      ])
    ).toEqual({
      intent: "prices",
      relatedLabel: "Prices",
      relatedPath: "/finances/materials",
    });

    expect(
      inferSavedThreadIntent([
        ...priorLocalTurn,
        { id: "u_new_vehicle", role: "user", content: "Help with my truck." },
        { id: "a_new_vehicle", role: "assistant", content: "Let's look at the truck." },
      ])
    ).toEqual({
      intent: "vehicle",
      relatedLabel: "Vehicle",
      relatedPath: "/vehicles",
    });
  });
});
