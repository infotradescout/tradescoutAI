// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoutSearchDock } from "./ScoutSearchDock";

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
});
