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
});
