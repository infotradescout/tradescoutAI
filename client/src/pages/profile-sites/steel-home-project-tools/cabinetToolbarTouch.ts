type TouchAction = {
  button: HTMLButtonElement; pointerId: number; x: number; y: number;
  toolbar: HTMLElement; scrollLeft: number; scrollTop: number; cancelled: boolean;
};
type CompletedTouch = {
  button: HTMLButtonElement; pointerId: number; x: number; y: number; until: number;
  state: 'pending' | 'native' | 'recovered' | 'cancelled'; timer?: number;
};

/**
 * Prefer the browser's click and normal focus timing. A stationary touch whose
 * click never arrives is recovered once after 120ms. Any late native click for
 * that same pointer is consumed; keyboard, mouse and assistive clicks stay native.
 */
export function installCabinetToolbarTouch(root: HTMLElement): () => void {
  let active: TouchAction | null = null;
  const completed: CompletedTouch[] = [];
  let dispatching = false;
  const buttonFor = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const button = target.closest<HTMLButtonElement>('[aria-label="Cabinet editing actions"] button');
    return button && root.contains(button) ? button : null;
  };
  const prune = () => {
    for (let index = completed.length - 1; index >= 0; index--) {
      if (performance.now() > completed[index].until) {
        window.clearTimeout(completed[index].timer);
        completed.splice(index, 1);
      }
    }
  };
  const cancel = () => { if (active) active.cancelled = true; };
  const down = (event: PointerEvent) => {
    prune();
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
    const hit = root.ownerDocument.elementFromPoint(event.clientX, event.clientY);
    const valid = !tap.cancelled && !tap.button.disabled && root.contains(tap.button) &&
      !!hit && (tap.button === hit || tap.button.contains(hit)) &&
      tap.toolbar.scrollLeft === tap.scrollLeft && tap.toolbar.scrollTop === tap.scrollTop &&
      Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= 8;
    const record: CompletedTouch = { button: tap.button, pointerId: tap.pointerId,
      x: event.clientX, y: event.clientY, until: performance.now() + 1200,
      state: valid ? 'pending' : 'cancelled' };
    completed.push(record);
    if (!valid) return;
    record.timer = window.setTimeout(() => {
      if (record.state !== 'pending') return;
      if (tap.button.disabled || !root.contains(tap.button) || root.ownerDocument.hidden) {
        record.state = 'cancelled'; return;
      }
      record.state = 'recovered';
      dispatching = true;
      try { tap.button.focus({ preventScroll: true }); tap.button.click(); }
      finally { dispatching = false; }
    }, 120);
  };
  const click = (event: MouseEvent) => {
    if (dispatching) return;
    const native = event as MouseEvent & { pointerId?: number; pointerType?: string; sourceCapabilities?: { firesTouchEvents?: boolean } };
    const fromTouch = native.pointerType === 'touch' || native.sourceCapabilities?.firesTouchEvents === true;
    if (!fromTouch) return;
    const button = buttonFor(event.target);
    const record = [...completed].reverse().find(item => item.button === button && performance.now() <= item.until &&
      (native.pointerId === undefined || native.pointerId === item.pointerId));
    if (!record) return;
    window.clearTimeout(record.timer);
    if (record.state === 'pending') {
      record.state = 'native';
      return; // Let the native click invoke the existing React action and focus behavior.
    }
    // Recovered, cancelled, or duplicate native gesture: never invoke the action twice.
    event.preventDefault(); event.stopImmediatePropagation();
  };
  const reset = () => {
    active = null;
    completed.forEach(record => window.clearTimeout(record.timer));
    completed.length = 0;
  };
  const visibility = () => { if (root.ownerDocument.hidden) reset(); };
  root.addEventListener('pointerdown', down, true);
  root.addEventListener('pointermove', move, true);
  root.addEventListener('pointerup', up, true);
  root.addEventListener('pointercancel', reset, true);
  root.addEventListener('contextmenu', cancel, true);
  root.addEventListener('scroll', cancel, true);
  root.addEventListener('click', click, true);
  window.addEventListener('blur', reset);
  root.ownerDocument.addEventListener('visibilitychange', visibility);
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
    root.ownerDocument.removeEventListener('visibilitychange', visibility);
  };
}
