import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ScoutThread, { EvidenceSourceList, scrollOpenScoutTaskHistoryToLatest } from "./ScoutThread";
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
  it("renders verified sources as links, context separately, and drops unsafe citations", () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceSourceList, {
        sources: [
          {
            title: "Travis County permit guidance",
            url: "https://www.traviscountytx.gov/tnr/development-services",
          },
          {
            title: "Unsafe citation",
            url: "javascript:alert(1)",
            type: "url_citation",
          },
          { title: "TradeScout knowledge context", type: "internal" },
        ],
      })
    );

    expect(html).toContain('href="https://www.traviscountytx.gov/tnr/development-services"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Sources:");
    expect(html).toContain("Context:");
    expect(html).toContain("TradeScout knowledge context");
    expect(html).not.toContain("Unsafe citation");
    expect(html).not.toContain("javascript:");
  });

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
        sources: [
          { title: "TradeScout Brain (data folder)" },
          {
            title: "Internet Search (Not Local TradeScout Data)",
            url: "https://example.gov/current-guidance",
            type: "url_citation",
          },
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
      resultContract: {
        contract_version: "scout_result.v1",
        intent: "provider_search",
        ambiguity_options: [],
        entities: [],
        evidence: [],
        answer: "I prepared your next step.",
        allowed_actions: [
          {
            action_id: "act_review",
            type: "PREFILL_INPUT",
            label: "Review and send",
            payload: {
              target: "direct_connect_request",
              prefill: {
                scope: "roof repair",
              },
            },
            primary: true,
            requires_confirmation: false,
          },
        ],
        working_memory_update: {},
      },
    };

    const html = renderThread([assistantMessage], false);

    expect(html).toContain("Scout result actions");
    expect(html).toContain("Available actions");
    expect(html).toContain("Review and send");
    expect(html).not.toContain("Search with Scout");
  });

  it("does not invent default actions for legacy local help cards", () => {
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
    expect(html).not.toContain("Create request");
    expect(html).not.toContain("Browse local help");
    expect(html).not.toContain("Choose next step");
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

  it("uses a neutral loading state without inferred progress or choices", () => {
    const userMessage: ScoutMessage = {
      id: "u_collect",
      role: "user",
      content: "My AC is not cooling",
      timestamp: new Date().toISOString(),
    };

    const html = renderThread([userMessage], false, { status: "checking_documents" });

    expect(html).toContain("Scout is working");
    expect(html).toContain("Nothing will be sent, published, or changed without your approval.");
    expect(html).not.toContain("Request context");
    expect(html).not.toContain("Add location");
    expect(html).not.toContain("Add timing");
  });
});

describe("Scout task history scrolling", () => {
  it("scrolls the internal thread to its latest message after open layout", () => {
    const scrollTo = vi.fn();
    const thread = { scrollHeight: 642, scrollTo };
    const querySelector = vi.fn(() => thread);
    const history = { open: true, querySelector } as unknown as HTMLDetailsElement;
    const scheduleFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    scrollOpenScoutTaskHistoryToLatest(history, scheduleFrame);

    expect(scheduleFrame).toHaveBeenCalledOnce();
    expect(querySelector).toHaveBeenCalledWith(".scout-thread");
    expect(scrollTo).toHaveBeenCalledWith({ top: 642, behavior: "auto" });
  });

  it("does not schedule a scroll when the history closes", () => {
    const history = {
      open: false,
      querySelector: vi.fn(),
    } as unknown as HTMLDetailsElement;
    const scheduleFrame = vi.fn();

    scrollOpenScoutTaskHistoryToLatest(history, scheduleFrame);

    expect(scheduleFrame).not.toHaveBeenCalled();
    expect(history.querySelector).not.toHaveBeenCalled();
  });
});
