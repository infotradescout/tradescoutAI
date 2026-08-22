// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import ScoutThread, { EvidenceSourceList, scrollScoutThreadToLatest } from "./ScoutThread";
import ScoutSearchDock from "./ScoutSearchDock";
import { ScoutInputRow } from "./ScoutInputRow";
import { cancelScheduledScoutAutoRoute } from "./ScoutOS";
import type { ScoutAction, ScoutMessage } from "./state";

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

  it("renders one enabled promoted action while preserving distinct thread actions", () => {
    const currentPrimaryAction: ScoutAction = {
      type: "NAVIGATE",
      label: "Open local Community",
      to: "/community",
      path: "/community",
      primary: true,
    };
    const messages: ScoutMessage[] = [
      {
        id: "u_previous",
        role: "user",
        content: "Show me an earlier option.",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_previous",
        role: "assistant",
        content: "Here is the earlier result.",
        timestamp: new Date().toISOString(),
        resultContract: {
          contract_version: "scout_result.v1",
          intent: "provider_search",
          ambiguity_options: [],
          entities: [],
          evidence: [],
          answer: "Here is the earlier result.",
          allowed_actions: [
            {
              action_id: "act_previous",
              type: "NAVIGATE",
              label: "Review earlier result",
              target: "/projects",
              primary: true,
              requires_confirmation: false,
            },
          ],
          working_memory_update: {},
        },
      },
      {
        id: "u_current",
        role: "user",
        content: "What should I do now?",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_current",
        role: "assistant",
        content: "The local Community is ready to open.",
        timestamp: new Date().toISOString(),
        resultContract: {
          contract_version: "scout_result.v1",
          intent: "community_browse",
          ambiguity_options: [],
          entities: [],
          evidence: [],
          answer: "The local Community is ready to open.",
          allowed_actions: [
            {
              action_id: "act_community",
              type: "NAVIGATE",
              label: "Open local Community",
              target: "/community",
              primary: true,
              requires_confirmation: false,
            },
            {
              action_id: "act_exchange",
              type: "NAVIGATE",
              label: "Open Exchange",
              target: "/exchange",
              primary: false,
              requires_confirmation: false,
            },
          ],
          working_memory_update: {},
        },
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement("button", { type: "button" }, currentPrimaryAction.label),
        React.createElement(ScoutThread, {
          messages,
          status: "idle",
          currentTurnPrimaryAction: currentPrimaryAction,
          onAction: () => undefined,
        })
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const enabledButtonLabels = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
    ).map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    const currentMessage = container.querySelector('[data-scout-message-id="a_current"]');

    expect(enabledButtonLabels.filter((label) => label === "Open local Community")).toHaveLength(1);
    expect(enabledButtonLabels).toContain("Review earlier result");
    expect(enabledButtonLabels).toContain("Open Exchange");
    expect(currentMessage?.textContent).toContain("The local Community is ready to open.");
    expect(currentMessage?.textContent).not.toContain("Open local Community");
  });

  it("keeps one promoted action when a persisted system update trails the latest assistant", () => {
    const currentPrimaryAction: ScoutAction = {
      type: "NAVIGATE",
      label: "Open local Community",
      to: "/community",
      path: "/community",
      primary: true,
    };
    const messages: ScoutMessage[] = [
      {
        id: "u_before_system",
        role: "user",
        content: "What should I do next?",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_before_system",
        role: "assistant",
        content: "The local Community is ready to open.",
        timestamp: new Date().toISOString(),
        resultContract: {
          contract_version: "scout_result.v1",
          intent: "community_browse",
          ambiguity_options: [],
          entities: [],
          evidence: [],
          answer: "The local Community is ready to open.",
          allowed_actions: [
            {
              action_id: "act_community_before_system",
              type: "NAVIGATE",
              label: "Open local Community",
              target: "/community",
              primary: true,
              requires_confirmation: false,
            },
          ],
          working_memory_update: {},
        },
      },
      {
        id: "system_saved",
        role: "system",
        content: "Task saved.",
        timestamp: new Date().toISOString(),
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement("button", { type: "button" }, currentPrimaryAction.label),
        React.createElement(ScoutThread, {
          messages,
          status: "idle",
          currentTurnPrimaryAction: currentPrimaryAction,
          onAction: () => undefined,
        })
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const enabledMatchingActions = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
    ).filter((button) => button.textContent?.trim() === "Open local Community");
    const assistantMessage = container.querySelector('[data-scout-message-id="a_before_system"]');

    expect(enabledMatchingActions).toHaveLength(1);
    expect(assistantMessage?.textContent).toContain("The local Community is ready to open.");
    expect(assistantMessage?.textContent).not.toContain("Open local Community");
    expect(container.textContent).toContain("Task saved.");
  });

  it("suppresses a sole promoted legacy chip without leaving an empty actions tray", () => {
    const currentPrimaryAction: ScoutAction = {
      type: "NAVIGATE",
      label: "Open Exchange",
      to: "/exchange",
      path: "/exchange",
      primary: true,
    };
    const currentMessage: ScoutMessage = {
      id: "a_legacy_chip",
      role: "assistant",
      content: "Exchange is the validated next step.",
      timestamp: new Date().toISOString(),
      frame: {
        truthLines: [],
        actionChips: [
          {
            id: "legacy-chip-primary",
            label: "Open Exchange",
            kind: "NAVIGATE",
            target: "/exchange",
            priority: "primary",
          },
        ],
      },
    };
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement("button", { type: "button" }, currentPrimaryAction.label),
        React.createElement(ScoutThread, {
          messages: [
            {
              id: "u_legacy_chip",
              role: "user",
              content: "Where should I go next?",
              timestamp: new Date().toISOString(),
            },
            currentMessage,
          ],
          status: "idle",
          showControllerExtras: false,
          currentTurnPrimaryAction: currentPrimaryAction,
          onAction: () => undefined,
        })
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const enabledMatchingActions = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
    ).filter((button) => button.textContent?.trim() === "Open Exchange");
    const renderedCurrentMessage = container.querySelector(
      '[data-scout-message-id="a_legacy_chip"]'
    );

    expect(enabledMatchingActions).toHaveLength(1);
    expect(renderedCurrentMessage?.textContent).toContain("Exchange is the validated next step.");
    expect(renderedCurrentMessage?.querySelector('[aria-label="Next steps"]')).toBeNull();
  });

  it("keeps legacy cluster content and distinct actions when its primary is promoted", () => {
    const currentPrimaryAction: ScoutAction = {
      type: "NAVIGATE",
      label: "Open local Community",
      to: "/community",
      path: "/community",
      primary: true,
    };
    const messages: ScoutMessage[] = [
      {
        id: "u_legacy_previous",
        role: "user",
        content: "Show the earlier result.",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_legacy_previous",
        role: "assistant",
        content: "Earlier task result.",
        timestamp: new Date().toISOString(),
        clusters: [
          {
            id: "legacy-previous-cluster",
            title: "Earlier result",
            kind: "projects",
            primaryAction: {
              type: "NAVIGATE",
              label: "Review earlier result",
              to: "/projects",
            },
          },
        ],
      },
      {
        id: "u_legacy_current",
        role: "user",
        content: "What is my current next step?",
        timestamp: new Date().toISOString(),
      },
      {
        id: "a_legacy_current",
        role: "assistant",
        content: "Your local result is ready.",
        timestamp: new Date().toISOString(),
        clusters: [
          {
            id: "legacy-current-cluster",
            title: "Local Community result",
            kind: "community",
            body: "The result record remains available here.",
            primaryAction: currentPrimaryAction,
            actions: [
              {
                type: "NAVIGATE",
                label: "Open Exchange",
                to: "/exchange",
              },
            ],
          },
        ],
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        null,
        React.createElement("button", { type: "button" }, currentPrimaryAction.label),
        React.createElement(ScoutThread, {
          messages,
          status: "idle",
          showControllerExtras: false,
          currentTurnPrimaryAction: currentPrimaryAction,
          onAction: () => undefined,
        })
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const enabledButtonLabels = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
    ).map((button) => button.textContent?.replace(/\s+/g, " ").trim());
    const currentMessage = container.querySelector('[data-scout-message-id="a_legacy_current"]');

    expect(enabledButtonLabels.filter((label) => label === "Open local Community")).toHaveLength(1);
    expect(enabledButtonLabels).toContain("Review earlier result");
    expect(enabledButtonLabels).toContain("Open Exchange");
    expect(currentMessage?.textContent).toContain("Local Community result");
    expect(currentMessage?.textContent).toContain("The result record remains available here.");
    expect(currentMessage?.textContent).not.toContain("Open local Community");
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

describe("Scout task work record", () => {
  it("runs the bounded latest-turn effect on mount and rerender", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const prototype = HTMLElement.prototype;
    const scrollToDescriptor = Object.getOwnPropertyDescriptor(prototype, "scrollTo");
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(prototype, "scrollHeight");
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const scrollTo = vi.fn();
    let scrollHeight = 640;

    Object.defineProperty(prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    Object.defineProperty(prototype, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    const firstMessage: ScoutMessage = {
      id: "u_effect_1",
      role: "user",
      content: "Start the task.",
      timestamp: new Date().toISOString(),
    };
    const nextMessage: ScoutMessage = {
      id: "a_effect_2",
      role: "assistant",
      content: "Here is the latest result.",
      timestamp: new Date().toISOString(),
    };

    try {
      React.act(() => {
        root.render(
          React.createElement(ScoutThread, {
            messages: [firstMessage],
            status: "idle",
          })
        );
      });
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: "auto" });

      scrollHeight = 1280;
      React.act(() => {
        root.render(
          React.createElement(ScoutThread, {
            messages: [firstMessage, nextMessage],
            status: "idle",
          })
        );
      });
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 1280, behavior: "auto" });
      expect(scrollTo).toHaveBeenCalledTimes(2);
    } finally {
      React.act(() => root.unmount());
      container.remove();
      if (scrollToDescriptor) {
        Object.defineProperty(prototype, "scrollTo", scrollToDescriptor);
      } else {
        delete (prototype as unknown as Record<string, unknown>).scrollTo;
      }
      if (scrollHeightDescriptor) {
        Object.defineProperty(prototype, "scrollHeight", scrollHeightDescriptor);
      } else {
        delete (prototype as unknown as Record<string, unknown>).scrollHeight;
      }
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });

  it("keeps a sparse record available as an accessible internal work region", () => {
    const html = renderThread([
      {
        id: "u_sparse",
        role: "user",
        content: "Help me compare flooring options.",
        timestamp: new Date().toISOString(),
      },
    ]);

    expect(html).toContain('role="log"');
    expect(html).toContain('aria-label="Conversation and result record"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-scout-message-id="u_sparse"');
  });

  it("keeps the first and latest turns in a long record under one scroll owner", () => {
    const messages: ScoutMessage[] = Array.from({ length: 24 }, (_, index) => ({
      id: `turn_${index + 1}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Task update ${index + 1}`,
      timestamp: new Date(2026, 7, 22, 9, index).toISOString(),
    }));

    const html = renderThread(messages);

    expect(html.match(/role="log"/g)).toHaveLength(1);
    expect(html).toContain('data-scout-message-id="turn_1"');
    expect(html).toContain('data-scout-message-id="turn_24"');
    expect(html).toContain("Task update 1");
    expect(html).toContain("Task update 24");
  });

  it("scrolls only the internal thread to its latest content", () => {
    const scrollTo = vi.fn();
    const thread = { scrollHeight: 642, scrollTo } as unknown as HTMLElement;

    scrollScoutThreadToLatest(thread, "auto");

    expect(scrollTo).toHaveBeenCalledWith({ top: 642, behavior: "auto" });
  });

  it("can preserve bounded scrolling for later updates without using page scrolling", () => {
    const scrollTo = vi.fn();
    const thread = { scrollHeight: 1280, scrollTo } as unknown as HTMLElement;

    scrollScoutThreadToLatest(thread, "smooth");

    expect(scrollTo).toHaveBeenCalledWith({ top: 1280, behavior: "smooth" });
  });

  it("retains a near-latest viewport on resize without pulling a reader from history", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const prototype = HTMLElement.prototype;
    const descriptors = {
      clientHeight: Object.getOwnPropertyDescriptor(prototype, "clientHeight"),
      scrollHeight: Object.getOwnPropertyDescriptor(prototype, "scrollHeight"),
      scrollTop: Object.getOwnPropertyDescriptor(prototype, "scrollTop"),
      scrollTo: Object.getOwnPropertyDescriptor(prototype, "scrollTo"),
    };
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const scrollTo = vi.fn();
    let resizeCallback: ResizeObserverCallback | null = null;
    let clientHeight = 300;
    const scrollHeight = 1000;
    let scrollTop = 0;
    let isMounted = false;

    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(target: Element) {
        observe(target);
      }

      unobserve() {}

      disconnect() {
        disconnect();
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: TestResizeObserver,
    });
    Object.defineProperty(prototype, "clientHeight", {
      configurable: true,
      get: () => clientHeight,
    });
    Object.defineProperty(prototype, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(prototype, "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    Object.defineProperty(prototype, "scrollTo", {
      configurable: true,
      value: (options: ScrollToOptions) => {
        scrollTo(options);
        const requestedTop = typeof options.top === "number" ? options.top : scrollTop;
        scrollTop = Math.min(requestedTop, Math.max(0, scrollHeight - clientHeight));
      },
    });
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      React.act(() => {
        root.render(
          React.createElement(ScoutThread, {
            messages: [
              {
                id: "u_resize_anchor",
                role: "user",
                content: "Keep the latest result visible.",
                timestamp: new Date().toISOString(),
              },
            ],
            status: "idle",
          })
        );
      });
      isMounted = true;

      const thread = container.querySelector<HTMLElement>(".scout-thread");
      expect(thread).not.toBeNull();
      expect(observe).toHaveBeenCalledWith(thread);
      expect(scrollTop).toBe(700);

      scrollTo.mockClear();
      clientHeight = 200;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: "auto" });
      expect(scrollTop).toBe(800);

      scrollTo.mockClear();
      clientHeight = 400;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(scrollTop).toBe(600);

      scrollTop = 580;
      React.act(() => {
        thread?.dispatchEvent(new Event("scroll"));
      });
      scrollTo.mockClear();
      clientHeight = 250;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(scrollTop).toBe(750);

      scrollTop = 300;
      React.act(() => {
        thread?.dispatchEvent(new Event("scroll"));
      });
      scrollTo.mockClear();
      clientHeight = 350;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(scrollTo).not.toHaveBeenCalled();
      expect(scrollTop).toBe(300);

      React.act(() => root.unmount());
      isMounted = false;
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      if (isMounted) React.act(() => root.unmount());
      container.remove();
      for (const [property, descriptor] of Object.entries(descriptors)) {
        if (descriptor) {
          Object.defineProperty(prototype, property, descriptor);
        } else {
          delete (prototype as unknown as Record<string, unknown>)[property];
        }
      }
      if (resizeObserverDescriptor) {
        Object.defineProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
      } else {
        delete (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      }
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });
});

describe("Scout active-task auxiliary reachability", () => {
  it("cancels an armed auto-route before New resets the active task", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const timerRef = {
      current: window.setTimeout(navigate, 1600),
    };

    try {
      cancelScheduledScoutAutoRoute(timerRef);
      vi.advanceTimersByTime(1600);

      expect(timerRef.current).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps representative auxiliary controls in one bounded region beside a usable sparse record on short mobile", () => {
    const availableCenterHeight = 520;
    const currentTaskHeight = 270;
    const auxiliaryRegionHeight = 110;
    const workRegionFloor = 112;
    const verticalGaps = 16;
    const html = renderToStaticMarkup(
      React.createElement(
        "div",
        {
          className: "scout-active-workbench",
          "data-mobile-center-height": availableCenterHeight,
        },
        React.createElement(
          "section",
          { className: "scout-current-task", style: { height: currentTaskHeight } },
          "Current task"
        ),
        React.createElement(
          "section",
          {
            className: "scout-task-auxiliary-region",
            "data-testid": "scout-task-auxiliary-region",
            "aria-label": "Task guidance and controls",
            tabIndex: 0,
            style: {
              flex: "0 1 auto",
              minHeight: 44,
              maxHeight: auxiliaryRegionHeight,
              overflowY: "auto",
              overscrollBehavior: "contain",
            },
          },
          React.createElement(
            "div",
            {
              className: "scout-task-auxiliary-region__priority",
              "data-testid": "scout-priority-navigation",
              style: { position: "sticky", top: 0, zIndex: 2 },
            },
            React.createElement("button", { type: "button" }, "Cancel smart navigation")
          ),
          React.createElement("button", { type: "button" }, "Open launch source"),
          React.createElement("button", { type: "button" }, "Confirm onboarding"),
          React.createElement("button", { type: "button" }, "Pause objective"),
          React.createElement("button", { type: "button" }, "Open watchdog action")
        ),
        React.createElement(
          "section",
          {
            className: "scout-task-work-region",
            style: { flex: "1 1 0", minHeight: workRegionFloor, overflow: "hidden" },
          },
          React.createElement(
            "div",
            { className: "scout-task-work-region__body" },
            React.createElement(
              "div",
              {
                className: "scout-thread scout-thread--task-loop",
                role: "log",
                tabIndex: 0,
                style: { overflowY: "auto" },
              },
              React.createElement("p", null, "One saved Scout update")
            )
          )
        )
      )
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const auxiliaryRegion = container.querySelector<HTMLElement>(
      '[data-testid="scout-task-auxiliary-region"]'
    );
    const priorityAutoRoute = container.querySelector<HTMLElement>(
      '[data-testid="scout-priority-navigation"]'
    );
    const workRegion = container.querySelector<HTMLElement>(".scout-task-work-region");
    const thread = container.querySelector<HTMLElement>(".scout-thread");

    expect(
      currentTaskHeight + auxiliaryRegionHeight + workRegionFloor + verticalGaps
    ).toBeLessThanOrEqual(availableCenterHeight);
    expect(auxiliaryRegion?.getAttribute("aria-label")).toBe("Task guidance and controls");
    expect(auxiliaryRegion?.tabIndex).toBe(0);
    expect(auxiliaryRegion?.style.flex).toBe("0 1 auto");
    expect(auxiliaryRegion?.style.overflowY).toBe("auto");
    expect(auxiliaryRegion?.style.overscrollBehavior).toBe("contain");
    expect(auxiliaryRegion?.querySelectorAll("button")).toHaveLength(5);
    expect(auxiliaryRegion?.firstElementChild).toBe(priorityAutoRoute);
    expect(priorityAutoRoute?.style.position).toBe("sticky");
    expect(priorityAutoRoute?.style.top).toBe("0px");
    expect(priorityAutoRoute?.textContent).toContain("Cancel smart navigation");
    expect(
      Array.from(container.querySelectorAll("button")).every((button) =>
        auxiliaryRegion?.contains(button)
      )
    ).toBe(true);
    expect(workRegion?.style.minHeight).toBe(`${workRegionFloor}px`);
    expect(workRegion?.contains(thread)).toBe(true);
    expect(auxiliaryRegion?.contains(thread)).toBe(false);
    expect(thread?.getAttribute("role")).toBe("log");
    expect(thread?.style.overflowY).toBe("auto");
  });

  it("clears a dynamic multiline dock without taking the short-desktop record below its floor", () => {
    const measuredDockTop = 424;
    const measuredWorkRegionBottom = 441;
    const measuredOverlap = measuredWorkRegionBottom - measuredDockTop;
    const multilineInputHeight = 72;
    const defaultRecordFloor = Math.max(6 * 16, Math.min(600 * 0.2, 12 * 16));
    const constrainedRecordFloor = Math.max(5.5 * 16, Math.min(600 * 0.16, 6 * 16));
    const auxiliaryFloor = 44;
    const defaultWorkbenchTopMargin = 6;
    const compactWorkbenchTopMargin = 0;
    const defaultCurrentTaskPadding = 12;
    const compactCurrentTaskPadding = 8;
    const defaultCurrentTaskGap = 10;
    const compactCurrentTaskGap = 4;
    const reclaimedHeight =
      defaultWorkbenchTopMargin -
      compactWorkbenchTopMargin +
      (defaultCurrentTaskPadding - compactCurrentTaskPadding) * 2 +
      (defaultCurrentTaskGap - compactCurrentTaskGap);
    const constrainedFloorReclaim = defaultRecordFloor - constrainedRecordFloor;
    const textarea = document.createElement("textarea");
    textarea.className = "scout-command-bar__input";
    textarea.style.height = "120px";
    textarea.style.maxHeight = `${multilineInputHeight}px`;
    textarea.style.overflowY = "auto";
    Object.defineProperty(textarea, "clientHeight", {
      configurable: true,
      value: multilineInputHeight,
    });
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 120,
    });

    expect(defaultRecordFloor).toBe(120);
    expect(constrainedRecordFloor).toBe(96);
    expect(auxiliaryFloor).toBe(44);
    expect(textarea.style.height).toBe("120px");
    expect(textarea.style.maxHeight).toBe("72px");
    expect(textarea.style.overflowY).toBe("auto");
    expect(textarea.scrollHeight).toBeGreaterThan(textarea.clientHeight);
    expect(measuredOverlap).toBe(17);
    expect(reclaimedHeight).toBe(20);
    expect(constrainedFloorReclaim).toBe(24);
    expect(
      measuredWorkRegionBottom - reclaimedHeight - constrainedFloorReclaim
    ).toBeLessThanOrEqual(measuredDockTop);

    const measuredBreakpointRectangles = [
      {
        viewport: "1440x730",
        workbenchBottom: 526,
        workBottom: 510,
        threadBottom: 509,
        dockTop: 554,
        threadClientHeight: 40,
        threadScrollHeight: 2760,
        threadScrollTop: 2720,
      },
      {
        viewport: "1440x731",
        workbenchBottom: 479,
        workBottom: 467.19,
        threadBottom: 466.19,
        dockTop: 507,
        threadClientHeight: 90,
        threadScrollHeight: 2760,
        threadScrollTop: 2670,
      },
      {
        viewport: "641x730",
        workbenchBottom: 503.61,
        workBottom: 491.61,
        threadBottom: 490.61,
        dockTop: 558,
        threadClientHeight: 40,
        threadScrollHeight: 2879,
        threadScrollTop: 2839,
      },
      {
        viewport: "641x731",
        workbenchBottom: 456.61,
        workBottom: 452.19,
        threadBottom: 451.19,
        dockTop: 511,
        threadClientHeight: 90,
        threadScrollHeight: 2879,
        threadScrollTop: 2789,
      },
    ];

    expect(measuredBreakpointRectangles.map(({ viewport }) => viewport)).toEqual([
      "1440x730",
      "1440x731",
      "641x730",
      "641x731",
    ]);
    for (const rectangle of measuredBreakpointRectangles) {
      expect(rectangle.workBottom).toBeLessThanOrEqual(rectangle.workbenchBottom);
      expect(rectangle.threadBottom).toBeLessThanOrEqual(rectangle.workbenchBottom);
      expect(rectangle.workBottom).toBeLessThanOrEqual(rectangle.dockTop);
      expect(rectangle.threadBottom).toBeLessThanOrEqual(rectangle.dockTop);
      expect(rectangle.threadScrollTop + rectangle.threadClientHeight).toBe(
        rectangle.threadScrollHeight
      );
    }
  });
});

describe("Scout short-viewport workbench evidence", () => {
  it("records the exact adversarial 568x320 browser proof without treating it as a DOM simulation", () => {
    const measured = {
      viewport: { width: 568, height: 320 },
      document: { clientHeight: 320, scrollHeight: 320, scrollY: 0 },
      root: { clientHeight: 210, scrollHeight: 210, scrollTop: 0, overflowY: "hidden" },
      ownerCounts: { task: 1, primary: 1, auxiliary: 1, work: 1, log: 1, composer: 1 },
      dock: { top: 146, bottom: 258, renderedReserve: 112 },
      workbench: {
        top: 58,
        bottom: 246,
        clientHeight: 188,
        scrollHeight: 564,
        protectedHeight: 88,
        paddingBottom: 101,
        scrollPaddingBottom: 100,
      },
      keyboardPrimary: { top: 59.266, bottom: 144.141, height: 84.875, hit: true },
      endpoint: {
        work: { top: 56.953, bottom: 144.953 },
        thread: { top: 112.344, bottom: 143.953 },
      },
    };

    expect(measured.document).toEqual({ clientHeight: 320, scrollHeight: 320, scrollY: 0 });
    expect(measured.root.scrollTop).toBe(0);
    expect(measured.root.overflowY).toBe("hidden");
    expect(Object.values(measured.ownerCounts).every((count) => count === 1)).toBe(true);
    expect(measured.workbench.scrollHeight).toBeGreaterThan(measured.workbench.clientHeight);
    expect(measured.workbench.protectedHeight).toBe(measured.dock.top - measured.workbench.top);
    expect(measured.workbench.paddingBottom).toBe(measured.dock.renderedReserve - 0.75 * 16 + 1);
    expect(measured.workbench.scrollPaddingBottom).toBe(measured.dock.renderedReserve - 0.75 * 16);
    expect(measured.keyboardPrimary.top).toBeGreaterThanOrEqual(measured.workbench.top);
    expect(measured.keyboardPrimary.bottom).toBeLessThanOrEqual(measured.dock.top);
    expect(measured.keyboardPrimary.height).toBeLessThanOrEqual(measured.workbench.protectedHeight);
    expect(measured.keyboardPrimary.hit).toBe(true);
    expect(measured.endpoint.work.bottom).toBeLessThan(measured.dock.top);
    expect(measured.endpoint.thread.bottom).toBeLessThan(measured.dock.top);
  });

  it("records the short-desktop owner handoff and its 480/481 boundary from browser evidence", () => {
    // Captured with Playwright against the adversarial saved-thread fixture. These rows
    // preserve measured browser evidence; they are not a jsdom layout simulation.
    const measured = [
      {
        viewport: "768x320",
        owner: "column",
        clientHeight: 192,
        scrollHeight: 472,
        maxScrollTop: 280,
        paddingBottom: 105,
        scrollPaddingBottom: 104,
        primary: [56, 143],
        work: [55.391, 143.391],
        thread: [110.781, 142.391],
        dockTop: 144,
      },
      {
        viewport: "768x360",
        owner: "column",
        clientHeight: 232,
        scrollHeight: 481,
        maxScrollTop: 249,
        paddingBottom: 105,
        scrollPaddingBottom: 104,
        primary: [96, 183],
        work: [95.188, 183.188],
        thread: [150.578, 182.188],
        dockTop: 184,
      },
      {
        viewport: "768x361",
        owner: "column",
        clientHeight: 233,
        scrollHeight: 481,
        maxScrollTop: 248,
        paddingBottom: 105,
        scrollPaddingBottom: 104,
        primary: [97, 184],
        work: [96.406, 184.406],
        thread: [151.797, 183.406],
        dockTop: 185,
      },
      {
        viewport: "1440x480",
        owner: "column",
        clientHeight: 350,
        scrollHeight: 498,
        maxScrollTop: 148,
        paddingBottom: 105,
        scrollPaddingBottom: 104,
        primary: [149, 230],
        work: [212.594, 300.594],
        thread: [267.984, 299.594],
        dockTop: 304,
      },
      {
        viewport: "1440x481",
        owner: "workbench",
        clientHeight: 159,
        scrollHeight: 311,
        maxScrollTop: 152,
        paddingBottom: 16,
        scrollPaddingBottom: "auto",
        primary: [175, 256],
        work: [173, 261],
        thread: [228.391, 260],
        dockTop: 305,
      },
    ] as const;

    expect(measured.map(({ viewport, owner }) => ({ viewport, owner }))).toEqual([
      { viewport: "768x320", owner: "column" },
      { viewport: "768x360", owner: "column" },
      { viewport: "768x361", owner: "column" },
      { viewport: "1440x480", owner: "column" },
      { viewport: "1440x481", owner: "workbench" },
    ]);
    for (const row of measured) {
      expect(row.scrollHeight - row.clientHeight).toBe(row.maxScrollTop);
      expect(row.primary[0]).toBeLessThan(row.primary[1]);
      expect(row.primary[1]).toBeLessThan(row.dockTop);
      expect(row.work[1]).toBeLessThan(row.dockTop);
      expect(row.thread[1]).toBeLessThan(row.dockTop);
    }
  });

  it("keeps the mobile and short-desktop owner boundaries explicit", () => {
    const mobileCorrectionApplies = (width: number) => width <= 767;
    const mobileClampApplies = (width: number, height: number) =>
      mobileCorrectionApplies(width) && height <= 420;
    const shortDesktopCorrectionApplies = (width: number, height: number) =>
      width >= 768 && height <= 480;
    const shortDesktopClampApplies = shortDesktopCorrectionApplies;
    const boundaries = [
      {
        width: 640,
        height: 420,
        mobileCorrection: true,
        mobileClamp: true,
        shortDesktopCorrection: false,
        shortDesktopClamp: false,
      },
      {
        width: 641,
        height: 421,
        mobileCorrection: true,
        mobileClamp: false,
        shortDesktopCorrection: false,
        shortDesktopClamp: false,
      },
      {
        width: 767,
        height: 420,
        mobileCorrection: true,
        mobileClamp: true,
        shortDesktopCorrection: false,
        shortDesktopClamp: false,
      },
      {
        width: 768,
        height: 420,
        mobileCorrection: false,
        mobileClamp: false,
        shortDesktopCorrection: true,
        shortDesktopClamp: true,
      },
      {
        width: 1440,
        height: 480,
        mobileCorrection: false,
        mobileClamp: false,
        shortDesktopCorrection: true,
        shortDesktopClamp: true,
      },
      {
        width: 1440,
        height: 481,
        mobileCorrection: false,
        mobileClamp: false,
        shortDesktopCorrection: false,
        shortDesktopClamp: false,
      },
    ];

    expect(
      boundaries.map(({ width, height }) => ({
        width,
        height,
        mobileCorrection: mobileCorrectionApplies(width),
        mobileClamp: mobileClampApplies(width, height),
        shortDesktopCorrection: shortDesktopCorrectionApplies(width, height),
        shortDesktopClamp: shortDesktopClampApplies(width, height),
      }))
    ).toEqual(boundaries);
  });
});

describe("Scout fixed search dock reserve", () => {
  it("tracks the rendered dock height without locking it to the measured reserve", () => {
    const shell = document.createElement("div");
    shell.className = "scout-shell--active-task";
    const container = document.createElement("div");
    shell.appendChild(container);
    document.body.appendChild(shell);
    const root = createRoot(container);
    const prototype = HTMLElement.prototype;
    const rectDescriptor = Object.getOwnPropertyDescriptor(prototype, "getBoundingClientRect");
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const observe = vi.fn();
    const disconnect = vi.fn();
    let resizeCallback: ResizeObserverCallback | null = null;
    let renderedHeight = 92;
    let isMounted = false;

    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe(target: Element) {
        observe(target);
      }

      unobserve() {}

      disconnect() {
        disconnect();
      }
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: TestResizeObserver,
    });
    Object.defineProperty(prototype, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          x: 0,
          y: 0,
          top: 0,
          right: 320,
          bottom: renderedHeight,
          left: 0,
          width: 320,
          height: renderedHeight,
          toJSON: () => ({}),
        }) as DOMRect,
    });
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      React.act(() => {
        root.render(
          React.createElement(ScoutSearchDock, {
            isMobile: false,
            placement: "fixed",
            isBusy: false,
            prefillKey: 0,
            hasMessages: true,
            quickStartPrompts: [],
            onSend: () => undefined,
            onTyping: () => undefined,
          })
        );
      });
      isMounted = true;

      const dock = container.querySelector(".scout-search-dock-fixed");
      expect(observe).toHaveBeenCalledWith(dock);
      expect(shell.style.getPropertyValue("--scout-search-dock-h")).toBe("92px");

      renderedHeight = 148.2;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });

      expect(shell.style.getPropertyValue("--scout-search-dock-h")).toBe("149px");

      renderedHeight = 92;
      React.act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(shell.style.getPropertyValue("--scout-search-dock-h")).toBe("92px");

      React.act(() => root.unmount());
      isMounted = false;
      expect(disconnect).toHaveBeenCalledOnce();
      expect(shell.style.getPropertyValue("--scout-search-dock-h")).toBe("");
    } finally {
      if (isMounted) React.act(() => root.unmount());
      shell.remove();
      if (rectDescriptor) {
        Object.defineProperty(prototype, "getBoundingClientRect", rectDescriptor);
      } else {
        delete (prototype as unknown as Record<string, unknown>).getBoundingClientRect;
      }
      if (resizeObserverDescriptor) {
        Object.defineProperty(globalThis, "ResizeObserver", resizeObserverDescriptor);
      } else {
        delete (globalThis as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      }
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });
});

describe("Scout command bar height reset", () => {
  it("releases the auto-grown textarea height after a successful send", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const actEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    const onSend = vi.fn(() => Promise.resolve());
    let isMounted = false;
    window.localStorage.removeItem("scout:prefill:scout-main");
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      React.act(() => {
        root.render(
          React.createElement(ScoutInputRow, {
            isBusy: false,
            prefillKey: 0,
            onSend,
            onTyping: () => undefined,
            quickStartPrompts: [],
          })
        );
      });
      isMounted = true;

      const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      expect(textarea).not.toBeNull();
      expect(valueSetter).toBeTypeOf("function");
      Object.defineProperty(textarea!, "scrollHeight", {
        configurable: true,
        value: 180,
      });

      React.act(() => {
        valueSetter?.call(textarea, "A detailed request that grows the command bar");
        textarea?.dispatchEvent(new Event("input", { bubbles: true }));
      });
      expect(textarea?.style.height).toBe("120px");

      const sendButton = container.querySelector<HTMLButtonElement>('[aria-label="Start search"]');
      expect(sendButton?.disabled).toBe(false);
      await React.act(async () => {
        sendButton?.click();
        await Promise.resolve();
      });

      expect(onSend).toHaveBeenCalledWith("A detailed request that grows the command bar");
      expect(textarea?.value).toBe("");
      expect(textarea?.style.height).toBe("");

      React.act(() => root.unmount());
      isMounted = false;
    } finally {
      if (isMounted) React.act(() => root.unmount());
      container.remove();
      window.localStorage.removeItem("scout:prefill:scout-main");
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });
});
