// @vitest-environment jsdom

import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearScoutReturnSnapshot, rememberScoutForReturn } from "./scoutReturnSnapshot";
import type { ScoutMessage } from "./state";
import { useScoutState } from "./state";
import { useScoutReturnRestoration } from "./useScoutReturnRestoration";

const messages: ScoutMessage[] = [
  { id: "u1", role: "user", content: "Find county posts", timestamp: "2026-09-24T00:00:00Z" },
  { id: "a1", role: "assistant", content: "One published post matches.", timestamp: "2026-09-24T00:00:01Z" },
];

const remoteSave = vi.fn();
let addFollowup: () => void = () => undefined;

type HarnessProps = {
  authLoading?: boolean;
  authTrusted?: boolean;
  currentLocation?: string;
  explicitLaunch?: boolean;
};

function Harness({
  authLoading = false,
  authTrusted = true,
  currentLocation = "/scout",
  explicitLaunch = false,
}: HarnessProps) {
  const { state, loadMessages, recordUserMessage } = useScoutState();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const onRestore = useCallback((id: string | null) => setActiveTaskId(id), []);
  const shouldSkipReturnAutoSave = useScoutReturnRestoration({
    authLoading,
    authTrusted,
    owner: "user:123",
    currentLocation,
    explicitLaunch,
    hasCurrentThread: state.messages.length > 0,
    loadMessages,
    onRestore,
  });

  useEffect(() => {
    if (shouldSkipReturnAutoSave(state.messages)) return;
    if (!state.messages.some((message) => message.role === "user")) return;
    const timer = window.setTimeout(() => remoteSave(state.messages), 450);
    return () => window.clearTimeout(timer);
  }, [shouldSkipReturnAutoSave, state.messages]);

  addFollowup = () => recordUserMessage("Show a second option");
  return <div data-testid="restored-task">{`${activeTaskId || "current"}: ${state.messages.map((message) => message.content).join(" | ")}`}</div>;
}

afterEach(() => {
  clearScoutReturnSnapshot();
  remoteSave.mockReset();
  vi.useRealTimers();
});

describe("mounted Scout return and save effects", () => {
  it("restores a result without a delayed remote save, then saves a new follow-up", () => {
    vi.useFakeTimers();
    rememberScoutForReturn("user:123", messages, "task-123", "/scout");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    try {
      React.act(() => root.render(<Harness />));
      expect(container.textContent).toContain("task-123: Find county posts | One published post matches.");
      React.act(() => vi.advanceTimersByTime(1_000));
      expect(remoteSave).not.toHaveBeenCalled();

      React.act(() => addFollowup());
      React.act(() => vi.advanceTimersByTime(450));
      expect(remoteSave).toHaveBeenCalledOnce();
      expect(remoteSave.mock.calls[0][0]).toHaveLength(3);
    } finally {
      React.act(() => root.unmount());
      container.remove();
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });

  it("lets a new explicit prompt replace a pending prior result", () => {
    rememberScoutForReturn("user:123", messages, "task-123", "/scout");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      React.act(() =>
        root.render(
          <Harness authLoading currentLocation="/scout?prompt=Find%20jobs" explicitLaunch />
        )
      );
      React.act(() =>
        root.render(<Harness currentLocation="/scout?prompt=Find%20jobs" explicitLaunch />)
      );
      expect(container.textContent).toBe("current: ");
      expect(remoteSave).not.toHaveBeenCalled();
    } finally {
      React.act(() => root.unmount());
      container.remove();
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });

  it("restores the result after browser Back to the original explicit launch entry", () => {
    const originalLocation = `${window.location.pathname}${window.location.search}`;
    const launch = "/scout?source=onboarding_result";
    window.history.replaceState({}, "", launch);
    rememberScoutForReturn("user:123", messages, "task-123", launch);
    window.history.replaceState({}, "", "/deals/00000000-0000-4000-8000-000000000201");
    window.history.replaceState({}, "", launch);
    window.dispatchEvent(new PopStateEvent("popstate"));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      React.act(() => root.render(<Harness currentLocation={launch} explicitLaunch />));
      expect(container.textContent).toContain("task-123: Find county posts | One published post matches.");
      expect(remoteSave).not.toHaveBeenCalled();
    } finally {
      React.act(() => root.unmount());
      container.remove();
      window.history.replaceState({}, "", originalLocation);
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });

  it("does not restore private content after failed auth revalidation", () => {
    rememberScoutForReturn("user:123", messages, "task-123", "/scout");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      React.act(() => root.render(<Harness authTrusted={false} />));
      React.act(() => root.render(<Harness authTrusted />));
      expect(container.textContent).toBe("current: ");
      expect(remoteSave).not.toHaveBeenCalled();
    } finally {
      React.act(() => root.unmount());
      container.remove();
      if (previousActEnvironment === undefined) {
        delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
      } else {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      }
    }
  });
});
