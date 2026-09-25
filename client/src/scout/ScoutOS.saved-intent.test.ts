// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { inferSavedThreadIntent, latestLocalSearchTitle } from "./ScoutOS";
import type { ScoutMessage } from "./state";

describe("saved Scout task intent", () => {
  it("titles the task from the latest local search, including a return to broad county browsing", () => {
    const broad = "Search TradeScout and my area for posts & deals in my county this week.";
    const plumbing =
      "Find TradeScout posts and deals about plumbing in my county this week. Include public posts linked to requests and local businesses.";
    const messages: ScoutMessage[] = [
      { id: "broad", role: "user", content: broad },
      { id: "topic", role: "user", content: plumbing },
    ];
    expect(latestLocalSearchTitle(messages)).toBe("Plumbing in my county");
    expect(latestLocalSearchTitle([...messages, { id: "broad-again", role: "user", content: broad }]))
      .toBe("Local posts & deals");
  });

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
