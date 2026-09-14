/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CabinetPlanView from "./CabinetPlanView";
import { createCabinetPlannerModule, reconcileCabinetPlannerExtension, type CabinetPlannerExtensionV1 } from "./cabinetPlannerModel";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Accessible direct cabinet placement', () => {
  let root: Root, container: HTMLDivElement;
  let change: ReturnType<typeof vi.fn<(value: CabinetPlannerExtensionV1) => void>>;
  const fixture = () => reconcileCabinetPlannerExtension({ starter: 'kitchen', shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true }, modules: [{ ...createCabinetPlannerModule('base-cabinet', 'a'), offsetIn: 40 }], selectedModuleId: 'a' });
  const render = async (planner = fixture()) => {
    await act(async () => { root.render(<CabinetPlanView planner={planner} onSelectModule={vi.fn()} onChange={change} />); });
    await vi.waitFor(() => expect(container.textContent).not.toContain('Loading measured cabinet plan'));
  };
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); change = vi.fn(); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it('supports eighth-inch arrows and one-inch shifted arrows without magnetic sticking', async () => {
    await render(); const item = container.querySelector('[data-module="a"]')!;
    act(() => item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(change.mock.calls[0][0].modules[0].offsetIn).toBe(40.125);
    act(() => item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true })));
    expect(change.mock.calls[1][0].modules[0].offsetIn).toBe(39);
  });
  it('provides equivalent movement buttons with accessible labels', async () => {
    await render(); const right = container.querySelector<HTMLButtonElement>('[aria-label="Move selected cabinet right"]')!;
    expect(right.disabled).toBe(false); act(() => right.click());
    expect(change.mock.calls[0][0].modules[0].offsetIn).toBe(40.125);
    expect(container.querySelector('[role="status"]')!.textContent).toContain('measurements need review');
  });
  it('does not commit a keyboard move into an adjoining cabinet', async () => {
    const state = fixture(); state.modules.push({ ...createCabinetPlannerModule('base-cabinet', 'b'), offsetIn: 70 });
    await render(state); act(() => container.querySelector('[data-module="a"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(change).not.toHaveBeenCalled(); expect(container.textContent).toContain('Move not applied');
  });
  it('keeps unresolved geometry empty and does not invent room dimensions', async () => {
    const state = fixture(); state.shell.widthIn = null; await render(state);
    expect(container.querySelector('svg')).toBeNull(); expect(container.textContent).toContain('Measured geometry unresolved'); expect(change).not.toHaveBeenCalled();
  });
  it('does not hijack browser or history shortcuts', async () => {
    await render(); act(() => container.querySelector('[data-module="a"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true })));
    expect(change).not.toHaveBeenCalled();
  });
});
