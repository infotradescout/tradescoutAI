// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoutSearchDock } from "./ScoutSearchDock";
import {
  SCOUT_MAIN_INPUT_DRAFT_KEY,
  SCOUT_MAIN_INPUT_OWNER_KEY,
  useScoutTaskDraftBoundary,
} from "./scoutTaskDraftBoundary";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const prompt = "Search TradeScout and my area for posts and deals in my county this week.";

describe("Scout search dock after a submitted request", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSend: ReturnType<typeof vi.fn<(value: string) => void>>;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onSend = vi.fn<(value: string) => void>();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  function RequestFlow() {
    const [hasMessages, setHasMessages] = useState(false);
    return hasMessages ? (
      <ScoutSearchDock
        key="follow-up"
        isMobile
        placement="fixed"
        isBusy={false}
        prefillKey={0}
        hasMessages
        quickStartPrompts={[]}
        onSend={onSend}
        onTyping={() => undefined}
      />
    ) : (
      <ScoutSearchDock
        key="first-request"
        isMobile
        placement="inline"
        isBusy={false}
        prefillKey={0}
        forcedPrefill={prompt}
        hasMessages={false}
        quickStartPrompts={[]}
        onSend={(value) => {
          onSend(value);
          setHasMessages(true);
        }}
        onTyping={() => undefined}
      />
    );
  }

  it("consumes the submitted draft before the fixed follow-up composer mounts", async () => {
    await act(async () => root.render(<RequestFlow />));
    expect(container.querySelector("textarea")?.value).toBe(prompt);
    expect(window.localStorage.getItem("scout:prefill:scout-main")).toBe(prompt);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Start search"]')?.click();
    });

    expect(onSend).toHaveBeenCalledExactlyOnceWith(prompt);
    expect(
      container.querySelector<HTMLTextAreaElement>(".scout-search-dock-fixed textarea")?.value
    ).toBe("");
    expect(window.localStorage.getItem("scout:prefill:scout-main")).toBeNull();
  });

  it("shows a one-use search entry without saving it as an account draft", async () => {
    window.localStorage.setItem(SCOUT_MAIN_INPUT_OWNER_KEY, "user:synthetic");
    window.localStorage.setItem(SCOUT_MAIN_INPUT_DRAFT_KEY, "Older private Scout draft");
    await act(async () => root.render(
      <ScoutSearchDock
        isMobile
        placement="inline"
        isBusy={false}
        prefillKey={0}
        forcedPrefill={prompt}
        draftOwner="user:synthetic"
        persistDraft={false}
        hasMessages={false}
        quickStartPrompts={[]}
        onSend={onSend}
        onTyping={() => undefined}
      />
    ));

    const input = container.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(input.value).toBe(prompt);
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBe("Older private Scout draft");

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(input, "Find local posts and deals in Maricopa County");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBe("Older private Scout draft");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Start search"]')?.click();
    });
    expect(onSend).toHaveBeenCalledExactlyOnceWith("Find local posts and deals in Maricopa County");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBe("Older private Scout draft");
  });

  it("ends one-use mode after submission and saves follow-up text for its account", async () => {
    function AliasFlow() {
      const [hasMessages, setHasMessages] = useState(false);
      const [entryActive, setEntryActive] = useState(true);
      const { version, changeTask } = useScoutTaskDraftBoundary();
      return (
        <ScoutSearchDock
          key={`${hasMessages ? "follow-up" : "search-entry"}:${version}`}
          isMobile
          placement={hasMessages ? "fixed" : "inline"}
          isBusy={false}
          prefillKey={0}
          forcedPrefill={entryActive ? prompt : undefined}
          draftOwner="user:synthetic"
          persistDraft={!entryActive}
          hasMessages={hasMessages}
          quickStartPrompts={[]}
          onSend={(value) => {
            if (entryActive) {
              changeTask();
              setEntryActive(false);
              setHasMessages(true);
            }
            onSend(value);
          }}
          onTyping={() => undefined}
        />
      );
    }

    window.localStorage.setItem(SCOUT_MAIN_INPUT_OWNER_KEY, "user:synthetic");
    window.localStorage.setItem(SCOUT_MAIN_INPUT_DRAFT_KEY, "Older private Scout draft");
    await act(async () => root.render(<AliasFlow />));
    expect(container.querySelector("textarea")?.value).toBe(prompt);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Start search"]')?.click();
    });
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();
    const followUp = container.querySelector<HTMLTextAreaElement>(".scout-search-dock-fixed textarea")!;
    expect(followUp.value).toBe("");

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(followUp, "A follow-up for this search");
      followUp.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_OWNER_KEY)).toBe("user:synthetic");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBe("A follow-up for this search");
  });
});
