type TouchAction = {
  button: HTMLButtonElement; pointerId: number; x: number; y: number;
  toolbar: HTMLElement; scrollLeft: number; scrollTop: number; cancelled: boolean;
};
type CompletedTouch = { button: HTMLButtonElement; pointerId: number; x: number; y: number; until: number };

/**
 * A drawing drag can be followed by pointerdown/up with no browser-generated click.
 * Resolve a stationary, single-finger toolbar tap at release and suppress ONLY its
 * following touch click. Mouse, keyboard and assistive-technology clicks stay native.
 */
export function installCabinetToolbarTouch(root: HTMLElement): () => void {
  let active: TouchAction | null = null;
  let completed: CompletedTouch | null = null;
  let dispatching = false;
  const buttonFor = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const button = target.closest<HTMLButtonElement>('[aria-label="Cabinet editing actions"] button');
    return button && root.contains(button) ? button : null;
  };
  const cancel = () => { if (active) active.cancelled = true; };
  const down = (event: PointerEvent) => {
    completed = null;
    if (event.pointerType !== 'touch' || !event.isPrimary || event.button !== 0 || active) { cancel(); return; }
    const button = buttonFor(event.target);
    if (!button || button.disabled) return;
    const toolbar = button.closest<HTMLElement>('[aria-label="Cabinet editing actions"]')!;
    active = { button, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      toolbar, scrollLeft: toolbar.scrollLeft, scrollTop: toolbar.scrollTop, cancelled: false };
  };
  const move = (event: PointerEvent) => {
    if (active?.pointerId === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 8) cancel();
  };
  const up = (event: PointerEvent) => {
    const tap = active;
    if (!tap || event.pointerId !== tap.pointerId) return;
    active = null;
    completed = { button: tap.button, pointerId: tap.pointerId, x: event.clientX, y: event.clientY, until: performance.now() + 800 };
    const hit = root.ownerDocument.elementFromPoint(event.clientX, event.clientY);
    if (tap.cancelled || tap.button.disabled || !root.contains(tap.button) ||
        !hit || !(tap.button === hit || tap.button.contains(hit)) ||
        tap.toolbar.scrollLeft !== tap.scrollLeft || tap.toolbar.scrollTop !== tap.scrollTop ||
        Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8) return;
    // Invoke the existing action, not a second save/history path. Capture ignores this
    // application-generated click but stops a duplicate native click from the same tap.
    dispatching = true;
    try { tap.button.focus({ preventScroll: true }); tap.button.click(); }
    finally { dispatching = false; }
  };
  const click = (event: MouseEvent) => {
    if (dispatching || !completed || buttonFor(event.target) !== completed.button || performance.now() > completed.until) return;
    const native = event as MouseEvent & { pointerId?: number; pointerType?: string; sourceCapabilities?: { firesTouchEvents?: boolean } };
    const fromTouch = native.pointerType === 'touch' || native.sourceCapabilities?.firesTouchEvents === true ||
      (!native.pointerType && event.detail > 0 && Math.hypot(event.clientX - completed.x, event.clientY - completed.y) <= 3);
    if (fromTouch && (native.pointerId === undefined || native.pointerId === completed.pointerId)) {
      completed = null; event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  const reset = () => { active = null; completed = null; };
  root.addEventListener('pointerdown', down, true);
  root.addEventListener('pointermove', move, true);
  root.addEventListener('pointerup', up, true);
  root.addEventListener('pointercancel', reset, true);
  root.addEventListener('contextmenu', cancel, true);
  root.addEventListener('scroll', cancel, true);
  root.addEventListener('click', click, true);
  window.addEventListener('blur', reset);
  return () => {
    reset();
    root.removeEventListener('pointerdown', down, true);
    root.removeEventListener('pointermove', move, true);
    root.removeEventListener('pointerup', up, true);
    root.removeEventListener('pointercancel', reset, true);
    root.removeEventListener('contextmenu', cancel, true);
    root.removeEventListener('scroll', cancel, true);
    root.removeEventListener('click', click, true);
    window.removeEventListener('blur', reset);
  };
}
