import assert from 'node:assert/strict';

/** Re-run the ORIGINAL mixed CDP-drag/Playwright-tap failure, not just the newer driver. */
export async function verifyCabinetNativeTouchRecovery({ browser, local, phase, deployed, record }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block',
    userAgent: `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Mobile Safari/537.36` });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort('blockedbyclient'));
  const key = 'tradescout:steel-home-project-tools:draft:v9';
  try {
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const button = name => page.getByRole('button', { name, exact: true });
    await page.goto(local, { waitUntil: 'networkidle' });
    await button('Load sample kitchen').tap();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.cabinets?.planner?.modules?.length === 3, key);
    const draft = await read(), base = draft.cabinets.planner.modules[0];
    draft.cabinets.planner = { ...draft.cabinets.planner, view: 'plan', selectedModuleId: 'native-base',
      modules: [{ ...base, id: 'native-base', offsetIn: 0 }],
      presentation: { style: 'Shaker', finish: 'sage', hardware: 'Matte black', fronts: { 'native-base': 'drawers' } },
    };
    const destination = phase === 'production' ? 'https://www.thetradescout.com/u/steel-home-packages/builders/cabinets' : local + '/cabinet-parent.html';
    const response = await page.goto(destination, { waitUntil: 'domcontentloaded' }); assert(response?.ok());
    if (phase === 'production') assert.equal(response.headers()['x-tradescout-build'], deployed);
    await page.getByTestId('steel-home-cabinet-designer').waitFor({ state: 'visible' });
    await page.evaluate(({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)), { key, draft });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-module="native-base"]').waitFor({ state: 'visible' });
    const before = await read();
    await button('Fit selected').tap();
    const module = page.locator('[data-module="native-base"]'); await module.scrollIntoViewIfNeeded();
    const point = await module.evaluate(node => {
      const rect = node.querySelector('rect').getBoundingClientRect(), m = node.ownerSVGElement.getScreenCTM();
      const shell = JSON.parse(localStorage.getItem('tradescout:steel-home-project-tools:draft:v9')).cabinets.planner.shell;
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, dx: Math.min(620 / shell.widthIn, 360 / shell.depthIn) * m.a * 12 };
    });
    const session = await context.newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    for (let n = 1; n <= 5; n++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + point.dx * n / 5, y: point.y }] });
    assert.deepEqual(await read(), before);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules[0].offsetIn === 12, key);
    const after = await read();
    // No delay, fallback click, retry or direct history call between release and this tap.
    await button('Undo').tap();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules[0].offsetIn === 0, key);
    assert.deepEqual(await read(), before);
    await button('Redo').tap();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules[0].offsetIn === 12, key);
    assert.deepEqual(await read(), after);
    await button('Undo').tap();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules[0].offsetIn === 0, key);
    assert.deepEqual(await read(), before);
    record('touch: original missing-click regression', 'The original raw-CDP drag followed immediately by a Playwright Undo tap now restores the complete draft; Redo and a second Undo each act once. No retry, timed wait or forced test click.');

    const focused = () => page.locator('.cabinet-design-focus').getAttribute('data-canvas-focus');
    await button('Focus drawing').tap(); assert.equal(await focused(), 'true');
    await button('Show inspector').tap(); assert.equal(await focused(), 'false');
    const target = button('Focus drawing'); await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 24, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await focused(), 'false', 'A toolbar swipe activated a button');
    await target.scrollIntoViewIfNeeded();
    const cancelBox = await target.boundingBox();
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cancelBox.x + 10, y: cancelBox.y + 10 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    assert.equal(await focused(), 'false');
    await target.focus(); await page.keyboard.press('Enter'); assert.equal(await focused(), 'true');
    await button('Show inspector').focus(); await page.keyboard.press('Space'); assert.equal(await focused(), 'false');
    assert.deepEqual(await read(), before); assert.deepEqual(errors, []);
    record('touch: no double activation or cancelled-action side effects', 'Two real taps toggle the view exactly twice; toolbar swipe and touchCancel do not activate it. Enter and Space still activate native buttons. All saved fields unchanged.');
  } finally { await context.close(); }
}
