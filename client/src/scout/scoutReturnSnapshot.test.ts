import { afterEach, describe, expect, it } from "vitest";
import type { ScoutMessage, ScoutState } from "./state";
import { scoutReducer } from "./state";
import {
  clearScoutReturnSnapshot,
  clearScoutReturnForNewLaunch,
  rememberScoutForReturn,
  takeScoutReturnSnapshot,
} from "./scoutReturnSnapshot";

const resultMessages: ScoutMessage[] = [
  { id: "user-1", role: "user", content: "Find local posts and deals", timestamp: "2026-09-24T00:00:00Z" },
  {
    id: "answer-1",
    role: "assistant",
    content: "One post and one TradeDeal match.",
    timestamp: "2026-09-24T00:00:01Z",
    clusters: [
      {
        id: "post-1",
        title: "Local post",
        kind: "community",
        primaryAction: { type: "NAVIGATE", label: "Open post", to: "/community/post/post-1" },
      },
    ],
  },
];

afterEach(clearScoutReturnSnapshot);

describe("Scout result return", () => {
  it("restores the same result and task once after opening a detail", () => {
    expect(rememberScoutForReturn("user:123", resultMessages, "task-123", "/scout", 1_000)).toBe(true);

    const restored = takeScoutReturnSnapshot("user:123", 2_000);
    expect(restored?.activeSavedThreadId).toBe("task-123");
    const empty: ScoutState = { messages: [], status: "idle", error: null, lastActions: [] };
    const returned = scoutReducer(empty, { type: "LOAD_MESSAGES", messages: restored!.messages });
    expect(returned.messages).toEqual(resultMessages);
    expect(returned.messages[1].clusters?.[0].primaryAction?.to).toBe("/community/post/post-1");
    expect(takeScoutReturnSnapshot("user:123", 3_000)).toBeNull();
  });

  it("does not show a prior account's result after an account switch", () => {
    rememberScoutForReturn("user:123", resultMessages, null, "/scout", 1_000);
    expect(takeScoutReturnSnapshot("user:456", 2_000)).toBeNull();
    expect(takeScoutReturnSnapshot("user:123", 3_000)).toBeNull();
  });

  it("expires an abandoned result and ignores an empty task", () => {
    expect(rememberScoutForReturn("guest", resultMessages.slice(1), null, "/scout", 1_000)).toBe(false);
    expect(takeScoutReturnSnapshot("guest", 2_000)).toBeNull();
    rememberScoutForReturn("guest", resultMessages, null, "/scout", 1_000);
    expect(takeScoutReturnSnapshot("guest", 16 * 60 * 1_000)).toBeNull();
  });

  it("discards an old result for a different explicit Scout launch", () => {
    rememberScoutForReturn("user:123", resultMessages, null, "/scout", 1_000);
    clearScoutReturnForNewLaunch("/scout?prompt=Find%20jobs", true);
    expect(takeScoutReturnSnapshot("user:123", 2_000)).toBeNull();
  });

  it("keeps a result when returning to its own launch entry", () => {
    const launch = "/scout?source=onboarding_result";
    rememberScoutForReturn("user:123", resultMessages, null, launch, 1_000);
    clearScoutReturnForNewLaunch(launch, true);
    expect(takeScoutReturnSnapshot("user:123", 2_000)?.messages).toEqual(resultMessages);
  });
});
