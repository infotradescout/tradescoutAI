// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoutTaskControls } from "./ScoutTaskControls";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("Scout task controls", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(saved: boolean, onSave: () => void, onNew: () => void, onDelete?: () => void) {
    await act(async () => {
      root.render(
        <ScoutTaskControls
          saved={saved}
          request="Find county posts and deals before contacting anyone."
          onSave={onSave}
          onNew={onNew}
          onDelete={onDelete}
        />
      );
    });
  }

  it("offers Save task for a current task and keeps New and the full request in Options", async () => {
    const save = vi.fn();
    const startNew = vi.fn();
    await render(false, save, startNew);

    const controls = container.querySelector('[aria-label="Thread controls"]')!;
    expect(controls.querySelectorAll(":scope > button, :scope > details")).toHaveLength(2);
    expect(controls.textContent).toContain("Full request");
    expect(controls.textContent).toContain("Find county posts and deals");
    expect(controls.textContent).not.toContain("Delete saved task");

    await act(async () => {
      controls.querySelector("button")!.click();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(startNew).not.toHaveBeenCalled();

    const options = controls.querySelector("details")!;
    await act(async () => options.querySelector("summary")!.click());
    expect(options.open).toBe(true);
    await act(async () => {
      [...controls.querySelectorAll("button")].find((button) => button.textContent === "Start new")!.click();
    });
    expect(startNew).toHaveBeenCalledTimes(1);
    expect(options.open).toBe(false);
  });

  it("shows a local saved state with New visible and manual save/delete in Options", async () => {
    const save = vi.fn();
    const startNew = vi.fn();
    const remove = vi.fn();
    await render(true, save, startNew, remove);

    const controls = container.querySelector('[aria-label="Thread controls"]')!;
    expect(controls.querySelectorAll(":scope > button, :scope > details")).toHaveLength(2);
    expect(controls.querySelector(":scope > button")?.textContent).toBe("Start new");
    expect(controls.textContent).toContain("Save current version");
    expect(controls.textContent).toContain("Delete saved task");

    const options = controls.querySelector("details")!;
    await act(async () => options.querySelector("summary")!.click());
    expect(options.open).toBe(true);
    await act(async () => {
      [...controls.querySelectorAll("button")].find((button) => button.textContent === "Save current version")!.click();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(options.open).toBe(false);
    expect(startNew).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();

    await act(async () => options.querySelector("summary")!.click());
    await act(async () => {
      [...controls.querySelectorAll("button")].find((button) => button.textContent === "Delete saved task")!.click();
    });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(options.open).toBe(false);
  });
});
