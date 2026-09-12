/** Synthetic browser evidence only. Listeners do not cancel events or change storage values. */
export async function installCabinetTouchTrace(page, key) {
  await page.addInitScript(storageKey => {
    const evidence = [];
    const push = value => { evidence.push(value); if (evidence.length > 100) evidence.shift(); };
    Object.defineProperty(window, '__cabinetTouchTrace', { configurable: true, value: evidence });
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (name === storageKey) {
        try {
          const planner = JSON.parse(value)?.cabinets?.planner;
          push({ action: 'save', offset: planner?.modules?.find(m => m.id === 'base')?.offsetIn, selected: planner?.selectedModuleId, at: performance.now() });
        } catch { /* Actual storage errors are still handled by the application's original call. */ }
      }
      return set.call(this, name, value);
    };
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'click']) {
      document.addEventListener(type, event => {
        if (!event.target?.closest?.('[data-testid="steel-home-cabinet-plan"], [aria-label="Cabinet editing actions"]')) return;
        const button = event.target.closest('button');
        push({ action: type, object: event.target.closest('[data-module]')?.getAttribute('data-module') || null,
          control: button?.getAttribute('aria-label') || button?.textContent || null,
          target: event.target.tagName, detail: event.detail, pointer: event.pointerId, pointerType: event.pointerType,
          x: event.clientX, y: event.clientY, at: performance.now() });
      }, true);
    }
  }, key);
}
export async function reportCabinetTouchTrace(page, key, context) {
  const trace = await page.evaluate(storageKey => {
    const drawing = document.querySelector('[data-testid="steel-home-cabinet-plan"]');
    const planner = JSON.parse(localStorage.getItem(storageKey) || 'null')?.cabinets?.planner;
    const toolbar = document.querySelector('[aria-label="Cabinet editing actions"]');
    return { events: window.__cabinetTouchTrace || [], offset: planner?.modules?.find(m => m.id === 'base')?.offsetIn,
      selected: planner?.selectedModuleId, viewBox: drawing?.getAttribute('viewBox'),
      status: document.querySelector('[data-testid="cabinet-placement-status"]')?.textContent,
      toolbar: toolbar ? { scrollLeft: toolbar.scrollLeft, controls: Array.from(toolbar.querySelectorAll('button')).map(button => ({ label: button.textContent, disabled: button.disabled, rect: button.getBoundingClientRect().toJSON() })) } : null,
      viewport: { width: innerWidth, height: innerHeight },
    };
  }, key);
  console.log('CANVAS_POINTER_TRACE ' + JSON.stringify({ ...context, ...trace }));
}
