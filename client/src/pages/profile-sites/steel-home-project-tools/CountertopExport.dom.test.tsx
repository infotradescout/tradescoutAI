/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CountertopDesigner from "./CountertopDesigner";
import { createEmptySteelHomeProjectDraft } from "./projectModel";

const drawing = vi.hoisted(() => ({ ready: false, pending: Promise.resolve(), release: () => {} }));
vi.mock("./MeasuredCountertopDesigner", () => ({ default: () => <div>Measured editor</div> }));
vi.mock("./CountertopPrecisionReview", () => ({
  default: () => {
    if (!drawing.ready) throw drawing.pending;
    return <svg data-testid="countertop-precision-drawing" viewBox="-12 -12 204 144"><polygon points="0,0 180,0 180,25.5 0,25.5" /></svg>;
  },
}));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Countertop export loading lifecycle", () => {
  let root: Root;
  let container: HTMLDivElement;
  let download: ReturnType<typeof vi.spyOn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  const OriginalURL = globalThis.URL;
  const button = (name: string) => Array.from(container.querySelectorAll("button")).find(node => node.textContent === name)!;
  async function releaseDrawing() {
    await act(async () => {
      drawing.ready = true;
      drawing.release();
      await drawing.pending;
    });
  }
  beforeEach(async () => {
    drawing.ready = false;
    drawing.pending = new Promise<void>(resolve => { drawing.release = resolve; });
    createObjectURL = vi.fn(() => "blob:countertop-review");
    vi.stubGlobal("URL", class extends OriginalURL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    });
    download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => { root.render(<CountertopDesigner design={createEmptySteelHomeProjectDraft().countertops} onChange={vi.fn()} onRequest={vi.fn()} />); });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("downloads exactly once after a delayed drawing loads, without a second click", async () => {
    await act(async () => button("Export drawing").click());
    expect(download).not.toHaveBeenCalled();
    expect(button("Export drawing").disabled).toBe(true);
    await releaseDrawing();
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(button("Export drawing").disabled).toBe(false);
    expect(container.textContent).toContain("Drawing download started");
  });
  it("cancels a pending download when returning to the editor", async () => {
    await act(async () => button("Export drawing").click());
    await act(async () => button("Edit design").click());
    await releaseDrawing();
    expect(download).not.toHaveBeenCalled();
    expect(button("Export drawing").disabled).toBe(false);
  });
  it("re-enables export and leaves the review visible when downloads fail", async () => {
    createObjectURL.mockImplementation(() => { throw new Error("Download denied"); });
    await act(async () => button("Export drawing").click());
    await releaseDrawing();
    await vi.waitFor(() => expect(container.textContent).toContain("Download unavailable"));
    expect(download).not.toHaveBeenCalled();
    expect(button("Export drawing").disabled).toBe(false);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
