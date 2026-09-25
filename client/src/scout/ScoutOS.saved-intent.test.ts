// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  buildSavedScoutThread,
  inferSavedThreadIntent,
  isUnchangedLoadedSavedTask,
  latestLocalSearchTitle,
  resolveScoutCurrentTaskTitle,
  scheduleScoutSavedTaskAutoSave,
  ScoutCurrentTaskHeading,
  type SavedScoutThread,
} from "./ScoutOS";
import type { ScoutMessage } from "./state";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

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

  it("uses the checked result topic when a one-word follow-up changes the county search", () => {
    const messages: ScoutMessage[] = [
      { id: "first", role: "user", content: "Find TradeScout posts and deals about plumbing near me" },
      { id: "first-answer", role: "assistant", content: "One plumbing match.", metadata: { discoveryTopic: "plumbing", discoveryChecks: {} } },
      { id: "follow-up", role: "user", content: "electrical" },
      { id: "follow-up-answer", role: "assistant", content: "No electrical matches.", metadata: { discoveryTopic: "electrical", discoveryChecks: {} } },
    ];
    expect(latestLocalSearchTitle(messages)).toBe("Electrical in my county");
    expect(latestLocalSearchTitle([
      ...messages,
      { id: "broad", role: "user", content: "Find local posts and deals near me" },
      { id: "broad-answer", role: "assistant", content: "County results.", metadata: { discoveryTopic: null, discoveryChecks: {} } },
    ])).toBe("Local posts & deals");
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

describe("saved Scout task heading", () => {
  it("settles on task B's saved title and updates only for a subsequent local search", async () => {
    const taskA: SavedScoutThread = {
      id: "A",
      title: "Roof inspection task A",
      preview: "Roof result",
      updatedAt: "2026-09-25T00:00:00.000Z",
      messageCount: 2,
      messages: [
        { id: "a-user", role: "user", content: "Find TradeScout posts and deals about roofing in my county this week." },
        { id: "a-result", role: "assistant", content: "Roof result." },
      ],
    };
    const taskB: SavedScoutThread = {
      id: "B",
      title: "Fence estimate task B",
      preview: "Fence result",
      updatedAt: "2026-09-25T00:00:00.000Z",
      messageCount: 2,
      messages: [
        { id: "b-user", role: "user", content: "Find TradeScout posts and deals about fencing in my county this week." },
        { id: "b-result", role: "assistant", content: "Fence result." },
      ],
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const show = async (thread: SavedScoutThread, messages: ScoutMessage[]) => {
      await act(async () => root.render(
        React.createElement(ScoutCurrentTaskHeading, {
          title: resolveScoutCurrentTaskTitle(messages, thread),
        })
      ));
      return container.querySelector('[data-testid="scout-current-task-title"]')?.textContent;
    };

    try {
      expect(await show(taskA, taskA.messages)).toBe("Roof inspection task A");
      expect(await show(taskB, taskB.messages)).toBe("Fence estimate task B");
      expect(isUnchangedLoadedSavedTask("B", taskB.messages, { id: "B", messages: taskB.messages }))
        .toBe(true);
      expect(buildSavedScoutThread(taskB.messages, "B", undefined, taskB)?.title)
        .toBe("Fence estimate task B");

      const genericFollowUp: ScoutMessage[] = [
        ...taskB.messages,
        { id: "b-followup", role: "user", content: "What should I check next?" },
      ];
      expect(await show(taskB, genericFollowUp)).toBe("Fence estimate task B");
      expect(buildSavedScoutThread(genericFollowUp, "B", undefined, taskB)?.title)
        .toBe("Fence estimate task B");

      const newSearch: ScoutMessage[] = [
        ...taskB.messages,
        { id: "b-new-search", role: "user", content: "Find TradeScout posts and deals about plumbing in my county this week." },
        { id: "b-new-result", role: "assistant", content: "Plumbing results checked.", metadata: { discoveryTopic: "plumbing", discoveryChecks: {} } },
      ];
      expect(isUnchangedLoadedSavedTask("B", newSearch, { id: "B", messages: taskB.messages }))
        .toBe(false);
      expect(await show(taskB, newSearch)).toBe("Plumbing in my county");
      const savedAfterSearch = buildSavedScoutThread(newSearch, "B", undefined, taskB);
      expect(savedAfterSearch?.title).toBe("Plumbing in my county");
      expect(await show(savedAfterSearch!, newSearch)).toBe("Plumbing in my county");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("does not schedule local or remote save for loaded B, then saves a new checked search", () => {
    vi.useFakeTimers();
    try {
      const savedMessages: ScoutMessage[] = [
        { id: "b-user", role: "user", content: "Find local fence estimate guidance this week." },
        { id: "b-result", role: "assistant", content: "Fence result." },
      ];
      const existing: SavedScoutThread = {
        id: "B",
        title: "Fence estimate task B",
        preview: "Fence result",
        updatedAt: "2026-09-25T00:00:00.000Z",
        messageCount: 2,
        messages: savedMessages,
      };
      const loaded = { id: "B", messages: savedMessages };
      const localSave = vi.fn<(messages: ScoutMessage[]) => SavedScoutThread | null>(
        (messages) => buildSavedScoutThread(messages, "B", undefined, existing)
      );
      const remoteSave = vi.fn<(thread: SavedScoutThread) => void>();
      const schedule = (messages: ScoutMessage[]) => scheduleScoutSavedTaskAutoSave({
        messages,
        activeSavedThreadId: "B",
        loadedTask: loaded,
        shouldSkipReturnAutoSave: () => false,
        onSave: () => {
          const saved = localSave(messages);
          if (saved) remoteSave(saved);
        },
      });

      schedule(savedMessages);
      vi.advanceTimersByTime(500);
      expect(localSave).not.toHaveBeenCalled();
      expect(remoteSave).not.toHaveBeenCalled();

      const newSearch: ScoutMessage[] = [
        ...savedMessages,
        { id: "new-user", role: "user", content: "Find TradeScout posts and deals about plumbing in my county this week." },
        { id: "new-result", role: "assistant", content: "Plumbing checked.", metadata: { discoveryTopic: "plumbing", discoveryChecks: {} } },
      ];
      const cancel = schedule(newSearch);
      vi.advanceTimersByTime(500);
      expect(localSave).toHaveBeenCalledTimes(1);
      expect(remoteSave).toHaveBeenCalledTimes(1);
      expect(remoteSave.mock.calls[0]?.[0].title).toBe("Plumbing in my county");
      cancel?.();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("mobile Scout task request", () => {
  it.each([
    {
      label: "resumed saved task",
      title: "Fence estimate task B",
      request: "Find local fence estimate guidance this week. Include county posts and deals, explain which results matter, and show safe next steps before I contact anyone.",
    },
    {
      label: "normal structured county result",
      title: "Local posts & deals",
      request: "Search TradeScout and my area for posts and deals in my county this week. Include matching pages, tools, local results, posts, and requests; show the best matches and why they matter.",
    },
  ])("shows and expands the original request for a $label at 390px", async ({ title, request }) => {
    const previousWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => root.render(
        React.createElement(ScoutCurrentTaskHeading, { title, request })
      ));
      expect(container.querySelector('[data-testid="scout-current-task-title"]')?.textContent)
        .toBe(title);
      const disclosure = container.querySelector<HTMLDetailsElement>(
        '[data-testid="scout-current-task-request"]'
      )!;
      expect(disclosure.open).toBe(false);
      expect(disclosure.querySelector("summary")?.textContent).toContain("Your request");
      const preview = disclosure.querySelector('[data-testid="scout-current-task-request-preview"]')!;
      expect(preview.textContent?.length).toBeLessThanOrEqual(96);
      expect(request.startsWith((preview.textContent || "").slice(0, 32))).toBe(true);

      await act(async () => disclosure.querySelector("summary")!.click());
      expect(disclosure.open).toBe(true);
      expect(disclosure.querySelector('[data-testid="scout-current-task-request-full"]')?.textContent)
        .toBe(request);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      if (previousWidth) Object.defineProperty(window, "innerWidth", previousWidth);
    }
  });

  it("does not show a request disclosure before a result is available", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(
        React.createElement(ScoutCurrentTaskHeading, { title: "Local posts & deals" })
      ));
      expect(container.querySelector('[data-testid="scout-current-task-request"]')).toBeNull();
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("closes task A's expanded request when a saved task B is selected", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(React.createElement(ScoutCurrentTaskHeading, {
        title: "Roof inspection task A", request: "Check roof inspection guidance this week.",
      })));
      await act(async () => container.querySelector("summary")!.click());
      expect(container.querySelector<HTMLDetailsElement>("details")?.open).toBe(true);

      await act(async () => root.render(React.createElement(ScoutCurrentTaskHeading, {
        title: "Fence estimate task B", request: "Find local fence estimate guidance this week.",
      })));
      const disclosure = container.querySelector<HTMLDetailsElement>("details")!;
      expect(disclosure.open).toBe(false);
      expect(disclosure.querySelector('[data-testid="scout-current-task-request-full"]')?.textContent)
        .toBe("Find local fence estimate guidance this week.");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
