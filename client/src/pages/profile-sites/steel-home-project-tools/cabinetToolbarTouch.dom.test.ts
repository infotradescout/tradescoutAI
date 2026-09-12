/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installCabinetToolbarTouch } from './cabinetToolbarTouch';

describe('Cabinet toolbar touch activation', () => {
  let root: HTMLDivElement, toolbar: HTMLDivElement, button: HTMLButtonElement;
  let dispose: () => void, action: ReturnType<typeof vi.fn>;
  let hit: Element | null;
  const originalHitTest = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
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
    vi.useFakeTimers();
    root = document.createElement('div'); toolbar = document.createElement('div');
    toolbar.setAttribute('aria-label', 'Cabinet editing actions');
    button = document.createElement('button'); button.textContent = 'Undo'; button.type = 'button';
    toolbar.append(button); root.append(toolbar); document.body.append(root);
    hit = button; Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => hit });
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    action = vi.fn(); button.addEventListener('click', action); dispose = installCabinetToolbarTouch(root);
  });
  afterEach(() => {
    dispose(); root.remove();
    if (originalHitTest) Object.defineProperty(document, 'elementFromPoint', originalHitTest); else Reflect.deleteProperty(document, 'elementFromPoint');
    if (originalHidden) Object.defineProperty(document, 'hidden', originalHidden); else Reflect.deleteProperty(document, 'hidden');
    vi.useRealTimers(); vi.restoreAllMocks();
  });
  it('recovers a missing click once, only after the native-click opportunity', () => {
    pointer('pointerdown'); pointer('pointerup'); expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(119); expect(action).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(action).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500); expect(action).toHaveBeenCalledTimes(1);
  });
  it('prefers a native click and cancels the fallback', () => {
    pointer('pointerdown'); pointer('pointerup'); touchClick();
    expect(action).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500); expect(action).toHaveBeenCalledTimes(1);
  });
  it('does not steal input focus after a native action', () => {
    const input = document.createElement('input'); root.append(input);
    button.addEventListener('click', () => input.focus());
    pointer('pointerdown'); pointer('pointerup'); touchClick();
    expect(document.activeElement).toBe(input);
    vi.advanceTimersByTime(500); expect(document.activeElement).toBe(input);
    expect(action).toHaveBeenCalledTimes(1);
  });
  it('suppresses only the late touch click after recovery, not a keyboard or programmatic action', () => {
    pointer('pointerdown'); pointer('pointerup'); vi.advanceTimersByTime(120);
    touchClick(); expect(action).toHaveBeenCalledTimes(1);
    button.click(); expect(action).toHaveBeenCalledTimes(2);
  });
  it('handles successive native taps as two actions, not four', () => {
    pointer('pointerdown'); pointer('pointerup'); touchClick();
    pointer('pointerdown', { pointerId: 2 }); pointer('pointerup', { pointerId: 2 }); touchClick(2);
    vi.advanceTimersByTime(500); expect(action).toHaveBeenCalledTimes(2);
  });
  it('does not lose a rapid second tap when both native clicks are missing', () => {
    pointer('pointerdown'); pointer('pointerup'); vi.advanceTimersByTime(40);
    pointer('pointerdown', { pointerId: 2 }); pointer('pointerup', { pointerId: 2 });
    vi.advanceTimersByTime(120); expect(action).toHaveBeenCalledTimes(2);
    touchClick(1); touchClick(2); expect(action).toHaveBeenCalledTimes(2);
  });
  it('preserves native mouse and keyboard activation', () => {
    pointer('pointerdown', { pointerType: 'mouse' }); pointer('pointerup', { pointerType: 'mouse' });
    vi.advanceTimersByTime(500); expect(action).not.toHaveBeenCalled();
    button.click(); expect(action).toHaveBeenCalledTimes(1);
    pointer('pointerdown'); pointer('pointerup'); touchClick();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    vi.advanceTimersByTime(500); expect(action).toHaveBeenCalledTimes(3);
  });
  it('does not activate after a scroll-like movement even if the finger returns', () => {
    pointer('pointerdown'); pointer('pointermove', { clientX: 50 }); pointer('pointerup'); touchClick();
    vi.advanceTimersByTime(500); expect(action).not.toHaveBeenCalled();
  });
  it('does not activate if the scroll container moved', () => {
    pointer('pointerdown'); toolbar.scrollLeft = 12; pointer('pointerup'); touchClick();
    vi.advanceTimersByTime(500); expect(action).not.toHaveBeenCalled();
  });
  it('does not activate after cancellation, context menu or blur', () => {
    for (const type of ['pointercancel', 'contextmenu', 'blur']) {
      pointer('pointerdown');
      if (type === 'blur') window.dispatchEvent(new Event(type)); else button.dispatchEvent(new Event(type, { bubbles: true }));
      pointer('pointerup'); vi.advanceTimersByTime(500);
    }
    expect(action).not.toHaveBeenCalled();
  });
  it('does not activate disabled actions or releases outside the button', () => {
    button.disabled = true; pointer('pointerdown'); pointer('pointerup');
    button.disabled = false; pointer('pointerdown'); button.disabled = true; pointer('pointerup');
    button.disabled = false; pointer('pointerdown'); hit = root; pointer('pointerup');
    vi.advanceTimersByTime(500); expect(action).not.toHaveBeenCalled();
  });
  it('cancels recovery if the action becomes disabled or is unmounted', () => {
    pointer('pointerdown'); pointer('pointerup'); button.disabled = true;
    vi.advanceTimersByTime(120); expect(action).not.toHaveBeenCalled();
    button.disabled = false; pointer('pointerdown', { pointerId: 2 }); pointer('pointerup', { pointerId: 2 }); button.remove();
    vi.advanceTimersByTime(120); expect(action).not.toHaveBeenCalled();
  });
  it('cancels a multi-touch interaction', () => {
    pointer('pointerdown'); pointer('pointerdown', { pointerId: 2, isPrimary: false });
    pointer('pointerup'); touchClick(); vi.advanceTimersByTime(500); expect(action).not.toHaveBeenCalled();
  });
  it('leaves buttons outside the cabinet toolbar alone', () => {
    toolbar.removeAttribute('aria-label'); pointer('pointerdown'); pointer('pointerup');
    vi.advanceTimersByTime(500); expect(action).not.toHaveBeenCalled();
    button.click(); expect(action).toHaveBeenCalledTimes(1);
  });
  it('cleans up pending recovery on blur and unmount', () => {
    pointer('pointerdown'); pointer('pointerup'); window.dispatchEvent(new Event('blur'));
    vi.advanceTimersByTime(120); expect(action).not.toHaveBeenCalled();
    pointer('pointerdown', { pointerId: 2 }); pointer('pointerup', { pointerId: 2 }); dispose();
    vi.advanceTimersByTime(120); expect(action).not.toHaveBeenCalled();
    button.click(); expect(action).toHaveBeenCalledTimes(1);
  });
});
