import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

/** Physical pointer input only: no DOM click(), dispatchEvent(), forced hits or retries. */
export async function createCabinetTouchDriver(context, page) {
  const session = await context.newCDPSession(page);
  const tap = async locator => {
    await locator.scrollIntoViewIfNeeded();
    await locator.waitFor({ state: 'visible' });
    assert(await locator.isEnabled(), 'A touch target must be enabled');
    const target = await locator.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const x = Math.max(0, rect.left) + (Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) / 2;
      const y = Math.max(0, rect.top) + (Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) / 2;
      const hit = document.elementFromPoint(x, y);
      return { x, y, hit: !!hit && (node === hit || node.contains(hit)), label: node.getAttribute('aria-label') || node.textContent };
    });
    assert(target.hit, 'Touch point is occluded: ' + target.label);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: target.x, y: target.y, id: 0, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(80);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  return { session, tap };
}

/** Standalone diagnostic; its outcomes are not feature or release approval. */
export async function diagnoseCabinetTouchActivation(browser) {
  const results = [];
  for (const mode of ['playwright-tap', 'same-session-immediate', 'same-session-80ms']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage();
      await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}button{position:absolute;left:130px;top:112px;width:60px;height:44px;touch-action:manipulation}#box{position:absolute;left:170px;top:520px;width:100px;height:70px;background:#ddd;touch-action:none}</style><button id="undo">Undo</button><div id="box"></div><script>window.trace=[];window.clicks=0;const b=document.getElementById('box');b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId)};b.onpointermove=e=>{if(b.hasPointerCapture(e.pointerId))e.preventDefault()};b.onpointerup=e=>{e.preventDefault();b.releasePointerCapture(e.pointerId)};document.getElementById('undo').onclick=()=>window.clicks++;for(const t of ['pointerdown','pointerup','click'])document.addEventListener(t,e=>window.trace.push({type:t,target:e.target.id,pointerType:e.pointerType,at:performance.now()}),true);</script>`);
      const driver = await createCabinetTouchDriver(context, page);
      await driver.session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 550 }] });
      for (const x of [205, 215, 225, 235, 247]) await driver.session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 550 }] });
      await driver.session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (mode === 'playwright-tap') await page.getByRole('button', { name: 'Undo' }).tap();
      else if (mode === 'same-session-80ms') await driver.tap(page.getByRole('button', { name: 'Undo' }));
      else {
        await driver.session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 134 }] });
        await driver.session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await delay(350);
      results.push({ mode, ...await page.evaluate(() => ({ clicks: window.clicks, events: window.trace })) });
    } finally { await context.close(); }
  }
  console.log('CABINET_TOUCH_DIAGNOSTIC ' + JSON.stringify({ browser: browser.version(), results }));
  return results;
}
