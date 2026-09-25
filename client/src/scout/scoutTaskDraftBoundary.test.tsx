// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScoutSearchDock from "./ScoutSearchDock";
import { SCOUT_MAIN_INPUT_DRAFT_KEY, useScoutTaskDraftBoundary } from "./scoutTaskDraftBoundary";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("Scout task draft boundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  let sent: ReturnType<typeof vi.fn<(task: string, text: string) => void>>;
  let discarded: ReturnType<typeof vi.fn<() => void>>;

  function Tasks() {
    const [task, setTask] = useState<"A" | "B" | "new">("A");
    const [composerMount, setComposerMount] = useState(0);
    const [unrelatedRender, setUnrelatedRender] = useState(0);
    const [prefillKey, setPrefillKey] = useState(0);
    const [externalPrefill, setExternalPrefill] = useState<string | undefined>();
    const { version, changeTask } = useScoutTaskDraftBoundary(discarded);

    return (
      <div>
        <span data-testid="task">{task}</span>
        <span data-testid="rerenders">{unrelatedRender}</span>
        <button type="button" onClick={() => setUnrelatedRender((value) => value + 1)}>
          Rerender same task
        </button>
        <button type="button" onClick={() => { changeTask(); setTask("B"); }}>
          Load task B
        </button>
        <button type="button" onClick={() => { changeTask(); setTask("new"); }}>
          Start new
        </button>
        <button type="button" onClick={() => setComposerMount((value) => value + 1)}>
          Reload composer
        </button>
        <button
          type="button"
          onClick={() => {
            const prompt = "Classic-to-Scout handoff about plumbing";
            window.localStorage.setItem(SCOUT_MAIN_INPUT_DRAFT_KEY, prompt);
            setExternalPrefill(prompt);
            setPrefillKey((value) => value + 1);
          }}
        >
          Open classic handoff
        </button>
        <ScoutSearchDock
          key={`scout-task-draft-${version}:${composerMount}`}
          isMobile
          placement={task === "new" ? "inline" : "fixed"}
          isBusy={false}
          prefillKey={prefillKey}
          forcedPrefill={externalPrefill}
          hasMessages={task !== "new"}
          quickStartPrompts={[]}
          onSend={(text) => sent(task, text)}
          onTyping={() => undefined}
        />
      </div>
    );
  }

  function textArea(): HTMLTextAreaElement {
    const input = container.querySelector<HTMLTextAreaElement>("textarea");
    if (!input) throw new Error("Scout composer was not rendered");
    return input;
  }

  function click(label: string): void {
    const button = [...container.querySelectorAll("button")].find(
      (candidate) =>
        candidate.textContent?.trim() === label || candidate.getAttribute("aria-label") === label
    );
    if (!button) throw new Error(`Missing ${label} control`);
    button.click();
  }

  function type(text: string): void {
    const input = textArea();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  beforeEach(async () => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    sent = vi.fn<(task: string, text: string) => void>();
    discarded = vi.fn<() => void>();
    await act(async () => root.render(<Tasks />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  it("keeps same-task typing but clears A before loading B, including a composer reload", async () => {
    await act(async () => type("Private task A details"));
    expect(textArea().value).toBe("Private task A details");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBe("Private task A details");

    await act(async () => click("Rerender same task"));
    expect(textArea().value).toBe("Private task A details");

    await act(async () => click("Load task B"));
    expect(container.querySelector('[data-testid="task"]')?.textContent).toBe("B");
    expect(textArea().value).toBe("");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();
    expect(discarded).toHaveBeenCalledTimes(1);

    await act(async () => click("Reload composer"));
    expect(textArea().value).toBe("");
    await act(async () => type("Task B plumbing follow-up"));
    await act(async () => click("Send follow-up"));
    expect(sent).toHaveBeenCalledExactlyOnceWith("B", "Task B plumbing follow-up");
    expect(sent).not.toHaveBeenCalledWith("B", "Private task A details");
  });

  it("starts new with a blank composer and still accepts an intentional classic handoff", async () => {
    await act(async () => type("Private task A details"));
    await act(async () => click("Start new"));
    expect(container.querySelector('[data-testid="task"]')?.textContent).toBe("new");
    expect(textArea().value).toBe("");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();

    await act(async () => click("Reload composer"));
    expect(textArea().value).toBe("");

    await act(async () => click("Open classic handoff"));
    expect(textArea().value).toBe("Classic-to-Scout handoff about plumbing");
    await act(async () => click("Start search"));
    expect(sent).toHaveBeenCalledExactlyOnceWith("new", "Classic-to-Scout handoff about plumbing");
    expect(window.localStorage.getItem(SCOUT_MAIN_INPUT_DRAFT_KEY)).toBeNull();
  });
});
