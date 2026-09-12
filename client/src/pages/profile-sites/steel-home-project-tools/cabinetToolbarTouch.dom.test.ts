/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installCabinetToolbarTouch } from './cabinetToolbarTouch';

describe('Cabinet toolbar touch activation', () => {
  let root: HTMLDivElement, toolbar: HTMLDivElement, button: HTMLButtonElement;
  let dispose: () => void, action: ReturnType<typeof vi.fn>;
  let hit: Element | null;
  const originalHitTest = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  const pointer = (type: string, patch: Partial<PointerEvent> = {}, target: Element = button) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 20, clientY: 20, button: 0 });
    for (const [key, value] of Object.entries({ pointerId: 1, pointerType: 'touch', isPrimary: true, ...patch })) Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
  };
  const touchClick = (pointerId = 1) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0, clientX: 20, clientY: 20 });
    Object.defineProperties(event, { pointerId: { value: pointerId }, pointerType: { value: 'touch' } });
    button.dispatchEvent(event);
  };
  beforeEach(() => {
    root = document.createElement('div'); toolbar = document.createElement('div');
    toolbar.setAttribute('aria-label', 'Cabinet editing actions');
    button = document.createElement('button'); button.textContent = 'Undo'; button.type = 'button';
    toolbar.append(button); root.append(toolbar); document.body.append(root);
    hit = button; Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => hit });
    action = vi.fn(); button.addEventListener('click', action); dispose = installCabinetToolbarTouch(root);
  });
  afterEach(() => {
    dispose(); root.remove();
    if (originalHitTest) Object.defineProperty(document, 'elementFromPoint', originalHitTest); else Reflect.deleteProperty(document, 'elementFromPoint');
    vi.restoreAllMocks();
  });
  it('activates on release even when the browser omits click', () => {
    pointer('pointerdown'); expect(action).not.toHaveBeenCalled();
    pointer('pointerup'); expect(action).toHaveBeenCalledTimes(1);
  });
  it('suppresses only the extra touch click from an already handled tap', () => {
    pointer('pointerdown'); pointer('pointerup'); touchClick(); expect(action).toHaveBeenCalledTimes(1);
    button.click(); expect(action).toHaveBeenCalledTimes(2);
  });
  it('handles two successive finger taps as two actions, not four', () => {
    pointer('pointerdown'); pointer('pointerup'); touchClick();
    pointer('pointerdown', { pointerId: 2 }); pointer('pointerup', { pointerId: 2 }); touchClick(2);
    expect(action).toHaveBeenCalledTimes(2);
  });
  it('preserves native mouse and keyboard activation', () => {
    pointer('pointerdown', { pointerType: 'mouse' }); pointer('pointerup', { pointerType: 'mouse' });
    expect(action).not.toHaveBeenCalled(); button.click(); expect(action).toHaveBeenCalledTimes(1);
    pointer('pointerdown'); pointer('pointerup');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(action).toHaveBeenCalledTimes(3);
  });
  it('does not activate after a scroll-like movement even if the finger returns', () => {
    pointer('pointerdown'); pointer('pointermove', { clientX: 50 }); pointer('pointerup'); touchClick();
    expect(action).not.toHaveBeenCalled();
  });
  it('does not activate if its scroll container moved', () => {
    pointer('pointerdown'); toolbar.scrollLeft = 12; pointer('pointerup'); touchClick();
    expect(action).not.toHaveBeenCalled();
  });
  it('does not activate after cancellation, context menu or blur', () => {
    for (const type of ['pointercancel', 'contextmenu', 'blur']) {
      pointer('pointerdown');
      if (type === 'blur') window.dispatchEvent(new Event(type)); else button.dispatchEvent(new Event(type, { bubbles: true }));
      pointer('pointerup');
    }
    expect(action).not.toHaveBeenCalled();
  });
  it('does not activate disabled actions or releases outside the button', () => {
    button.disabled = true; pointer('pointerdown'); pointer('pointerup');
    button.disabled = false; pointer('pointerdown'); button.disabled = true; pointer('pointerup');
    button.disabled = false; pointer('pointerdown'); hit = root; pointer('pointerup');
    expect(action).not.toHaveBeenCalled();
  });
  it('cancels a multi-touch interaction', () => {
    pointer('pointerdown'); pointer('pointerdown', { pointerId: 2, isPrimary: false });
    pointer('pointerup'); touchClick(); expect(action).not.toHaveBeenCalled();
  });
  it('leaves buttons outside the cabinet toolbar alone', () => {
    toolbar.removeAttribute('aria-label'); pointer('pointerdown'); pointer('pointerup');
    expect(action).not.toHaveBeenCalled(); button.click(); expect(action).toHaveBeenCalledTimes(1);
  });
  it('removes listeners when the editor unmounts', () => {
    dispose(); pointer('pointerdown'); pointer('pointerup'); expect(action).not.toHaveBeenCalled();
    button.click(); expect(action).toHaveBeenCalledTimes(1);
  });
});
