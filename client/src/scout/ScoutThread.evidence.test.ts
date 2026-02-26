import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ScoutThread from "./ScoutThread";
import type { ScoutMessage } from "./state";

function renderThread(messages: ScoutMessage[]): string {
  return renderToStaticMarkup(
    React.createElement(ScoutThread, {
      messages,
      status: "idle",
      showControllerExtras: false,
    })
  );
}

describe("ScoutThread evidence strip", () => {
  it("renders provenance chips and evidence sources for assistant messages", () => {
    const assistantMessage: ScoutMessage = {
      id: "a_1",
      role: "assistant",
      content: "Here is the current best path.",
      timestamp: new Date().toISOString(),
      provenance: {
        sourceUsed: "classic_knowledge_pipeline",
        confidenceBand: "medium",
        fallbackUsed: true,
        knowledgeLayer: 3,
        blockingReason: "auth_required",
        sourceTitles: [
          "TradeScout Brain (data folder)",
          "Internet Search (Not Local TradeScout Data)",
        ],
        allowedActions: ["ASK_SCOUT"],
      },
    };

    const html = renderThread([assistantMessage]);

    expect(html).toContain("Source: Classic Knowledge Pipeline");
    expect(html).toContain("Confidence: Medium");
    expect(html).toContain("Layer: 3");
    expect(html).toContain("Fallback: Active");
    expect(html).toContain("Authority: Gated (Auth Required)");
    expect(html).toContain("Evidence: TradeScout Brain (data folder)");
  });

  it("does not render evidence strip for user-only messages", () => {
    const userMessage: ScoutMessage = {
      id: "u_1",
      role: "user",
      content: "find me a roofer",
      timestamp: new Date().toISOString(),
    };

    const html = renderThread([userMessage]);

    expect(html).not.toContain("scout-evidence-strip");
    expect(html).not.toContain("Evidence:");
  });
});
