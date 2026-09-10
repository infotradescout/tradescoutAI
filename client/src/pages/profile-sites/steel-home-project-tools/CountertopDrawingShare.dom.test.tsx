/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CountertopDrawingReview from "./CountertopDrawingReview";
import { createEmptySteelHomeProjectDraft } from "./projectModel";
import { parseCountertopStudioShareUrl } from "./countertopStudioShare";

vi.mock("./CountertopPrecisionReview", () => ({ default: () => <svg data-testid="countertop-precision-drawing" /> }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Sharing from the dimensioned countertop review", () => {
  let root: Root;
  let container: HTMLDivElement;
  let clipboard: PropertyDescriptor | undefined;
  const design = () => ({
    ...createEmptySteelHomeProjectDraft().countertops,
    stoneId: "cristallo", wallAIn: 180, roomWidthIn: 240,
    sink: "Single-bowl undermount" as const, sinkRun: "main" as const,
    sinkPositionIn: 75, sinkFrontPositionIn: 12.75,
    sinkTemplateWidthIn: 30, sinkTemplateDepthIn: 18,
    floorStone: true, notes: "PRIVATE synthetic project note", measurementsReviewed: true,
  });
  async function render(value = design()) {
    await act(async () => { root.render(<CountertopDrawingReview design={value} exportRequested={false} onExportComplete={vi.fn()} />); });
  }
  beforeEach(() => {
    window.history.replaceState(null, "", "/u/steel-home-packages/builders/countertops?unrelated=private");
    clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard denied")) } });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove();
    if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
  });
  it("provides a copyable canonical URL with dimensions but no notes, inherited query, or floor preview", async () => {
    const input = design();
    await render(input);
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    const url = container.querySelector<HTMLInputElement>('input[aria-label="Drawing plan link"]')!.value;
    const shared = parseCountertopStudioShareUrl(url);
    expect(new URL(url).pathname).toBe("/u/steel-home-packages/builders/countertops");
    expect(new URL(url).searchParams.has("unrelated")).toBe(false);
    expect(shared).toMatchObject({ stoneId: "cristallo", wallAIn: 180, roomWidthIn: 240, sinkTemplateWidthIn: 30, sinkTemplateDepthIn: 18, notes: "", floorStone: false });
    expect(container.textContent).toContain("Select and copy the link below");
    expect(input.notes).toBe("PRIVATE synthetic project note");
    expect(input.floorStone).toBe(true);
  });
  it("removes stale share links after design changes", async () => {
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(container.querySelector("input")).not.toBeNull();
    await render({ ...design(), wallAIn: 192 });
    expect(container.querySelector("input")).toBeNull();
  });
  it("does not create a share link without a named stone", async () => {
    await render({ ...design(), stoneId: "" });
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    expect(container.querySelector("input")).toBeNull();
    expect(container.textContent).toContain("Choose a named stone");
  });
});
