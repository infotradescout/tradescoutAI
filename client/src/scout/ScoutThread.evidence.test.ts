import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ScoutThread from "./ScoutThread";
import type { ScoutMessage } from "./state";

function renderThread(
  messages: ScoutMessage[],
  showControllerExtras = false,
  options?: { status?: "idle" | "resolving_context" | "checking_documents" | "ready" }
): string {
  return renderToStaticMarkup(
    React.createElement(ScoutThread, {
      messages,
      status: options?.status ?? "idle",
      showControllerExtras,
      onPrefill: () => undefined,
    })
  );
}

describe("ScoutThread evidence strip", () => {
  it("renders an evidence toggle for assistant messages when controller extras are enabled", () => {
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

    const html = renderThread([assistantMessage], true);

    expect(html).toContain("scout-evidence-strip");
    expect(html).toContain(">Why this helps<");
    // Details are collapsed by default; content renders after a user toggle in the browser.
    expect(html).not.toContain("Source:");
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
    expect(html).not.toContain("Checked:");
  });

  it("renders action surfaces even when controller extras are disabled", () => {
    const assistantMessage: ScoutMessage = {
      id: "a_actions",
      role: "assistant",
      content: "I prepared your next step.",
      timestamp: new Date().toISOString(),
      clusters: [
        {
          id: "server-actions",
          title: "Actions",
          kind: "generic",
          actions: [
            {
              type: "PREFILL_INPUT",
              label: "Review and send",
              payload: {
                target: "direct_connect_request",
                prefill: {
                  scope: "roof repair",
                },
              },
              primary: true,
            },
          ],
        },
      ],
    };

    const html = renderThread([assistantMessage], false);

    expect(html).toContain("Next steps");
    expect(html).toContain("scout-cluster-card");
    expect(html).toContain("Review and send");
    expect(html).toContain("Search");
    expect(html).not.toContain("Search with Scout");
  });

  it("adds casual default actions for local help result cards", () => {
    const assistantMessage: ScoutMessage = {
      id: "a_local_help",
      role: "assistant",
      content: "Here are local help options.",
      timestamp: new Date().toISOString(),
      clusters: [
        {
          id: "pros",
          title: "Roof help nearby",
          kind: "pros",
          body: "Compare local options before contact opens.",
        },
      ],
    };

    const html = renderThread([assistantMessage], false);

    expect(html).toContain("Local help");
    expect(html).toContain("Create request");
    expect(html).toContain("Browse local help");
    expect(html).toContain("Search");
    expect(html).not.toContain("Search with Scout");
  });

  it("summarizes long assistant answers when result cards carry the real next steps", () => {
    const assistantMessage: ScoutMessage = {
      id: "a_summary",
      role: "assistant",
      content:
        "Here is the short version. The longer explanation includes multiple paragraphs, background, tradeoffs, and context that should not dominate the default chat bubble.\n\nSecond paragraph with extra detail that should stay behind the details toggle by default.",
      timestamp: new Date().toISOString(),
      clusters: [
        {
          id: "next",
          title: "Best next step",
          kind: "rules",
          body: "Review what matters before contact.",
        },
      ],
    };

    const html = renderThread([assistantMessage]);

    expect(html).toContain("Here is the short version.");
    expect(html).toContain(">More detail<");
    expect(html).not.toContain("Second paragraph with extra detail");
    expect(html).toContain("Best next step");
  });

  it("collects useful details outside the chat while Scout is working", () => {
    const userMessage: ScoutMessage = {
      id: "u_collect",
      role: "user",
      content: "My AC is not cooling",
      timestamp: new Date().toISOString(),
    };

    const html = renderThread([userMessage], false, { status: "checking_documents" });

    expect(html).toContain("Details Scout can use");
    expect(html).toContain("Add location");
    expect(html).toContain("Add timing");
  });
});
