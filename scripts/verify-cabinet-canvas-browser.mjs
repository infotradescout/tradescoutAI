import assert from 'node:assert/strict';
import path from 'node:path';
import { installCabinetTouchTrace, reportCabinetTouchTrace } from './cabinet-touch-trace.mjs';
import { createCabinetTouchDriver, diagnoseCabinetTouchActivation } from './cabinet-touch-driver.mjs';

export async function verifyCabinetCanvas({ browser, local, phase, deployed, working, record }) {
  await diagnoseCabinetTouchActivation(browser);
  const key = 'tradescout:steel-home-project-tools:draft:v9';
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['laptop', { width: 1366, height: 768 }], ['touch', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block', acceptDownloads: true,
      userAgent: `Mozilla/5.0 (${device === 'touch' ? 'Linux; Android 13; Pixel 7' : 'Windows NT 10.0; Win64; x64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} ${device === 'touch' ? 'Mobile ' : ''}Safari/537.36` });
    let page; const errors = [], writes = [];
    await context.route('**/*', route => {
      const req = route.request();
      if (!['GET', 'HEAD'].includes(req.method())) { writes.push(new URL(req.url()).pathname); return route.abort('blockedbyclient'); }
      return route.continue();
    });
    try {
      page = await context.newPage(); page.setDefaultTimeout(30000);
      await installCabinetTouchTrace(page, key);
      page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
      const touch = device === 'touch' ? await createCabinetTouchDriver(context, page) : null;
      const session = touch?.session ?? null;
      const click = async locator => { await locator.scrollIntoViewIfNeeded(); if (touch) await touch.tap(locator); else await locator.click(); };
      const button = name => page.getByRole('button', { name, exact: true });
      const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
      await page.goto(local, { waitUntil: 'networkidle' });
      await click(button('Load sample kitchen'));
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.cabinets?.planner?.modules?.length === 3, key);
      const sample = await read(), source = sample.cabinets.planner.modules[0];
      sample.cabinets.notes = 'Synthetic canvas notes';
      sample.cabinets.planner = { ...sample.cabinets.planner, starter: 'kitchen', view: 'plan', selectedModuleId: 'upper', notes: 'Synthetic canvas notes',
        shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true }, shellItems: [],
        modules: [
          { ...source, id: 'base', label: 'Sink base', widthIn: 30, depthIn: 24, heightIn: 34.5, elevationIn: 0, surface: 'north', offsetIn: 0 },
          { ...source, id: 'upper', label: 'Wall cabinet', kind: 'wall-cabinet', widthIn: 30, depthIn: 12, heightIn: 30, elevationIn: 54, surface: 'north', offsetIn: 0 },
          { ...source, id: 'next', label: 'Drawer base', widthIn: 30, depthIn: 24, heightIn: 34.5, elevationIn: 0, surface: 'north', offsetIn: 90 },
          { ...source, id: 'panel', label: 'End panel', kind: 'end-panel', widthIn: .75, depthIn: 24, heightIn: 34.5, elevationIn: 0, surface: 'north', offsetIn: 45, wallInsetIn: 0 },
        ], presentation: { style: 'Shaker', finish: 'sage', hardware: 'Brushed brass', fronts: { base: 'sink', upper: 'doors', next: 'drawers' } },
      };
      const destination = phase === 'production' ? 'https://www.thetradescout.com/u/steel-home-packages/builders/cabinets' : local + '/cabinet-parent.html';
      const response = await page.goto(destination, { waitUntil: 'domcontentloaded' }); assert(response?.ok());
      if (phase === 'production') assert.equal(response.headers()['x-tradescout-build'], deployed);
      await page.getByTestId('steel-home-cabinet-designer').waitFor({ state: 'visible' });
      await page.evaluate(({ key, sample }) => localStorage.setItem(key, JSON.stringify(sample)), { key, sample });
      const reloaded = await page.reload({ waitUntil: 'domcontentloaded' });
      if (phase === 'production') assert.equal(reloaded.headers()['x-tradescout-build'], deployed);
      await page.locator('[data-module="base"]').waitFor({ state: 'visible' });
      const initial = await read();
      const layer = page.getByLabel('Cabinet plan layer', { exact: true });
      await layer.selectOption('lower');
      assert.equal(await page.locator('[data-module="upper"]').count(), 0);
      assert.equal(await page.locator('[data-layer-ghost="upper"]').count(), 1);
      assert.equal(await page.locator('[data-module="panel"]').count(), 0);
      assert.deepEqual(await read(), initial);
      await click(page.locator('[data-module="base"]'));
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.selectedModuleId === 'base', key);
      const baseline = await read();
      const drawing = page.getByTestId('steel-home-cabinet-plan');
      const normalView = await drawing.getAttribute('viewBox');
      await click(button('Fit selected'));
      assert.notEqual(await drawing.getAttribute('viewBox'), normalView);
      assert.deepEqual(await read(), baseline);
      record(`${device}: reachable overlapping cabinets`, 'Lower layer exposes a base beneath its upper cabinet; other layers remain read-only ghost outlines; selecting and fitting an object preserves all measured fields');

      const dragBase = async inches => {
        const item = page.locator('[data-module="base"]'); await item.scrollIntoViewIfNeeded();
        const p = await item.evaluate(node => {
          const box = node.querySelector('rect').getBoundingClientRect(), matrix = node.ownerSVGElement.getScreenCTM();
          const room = JSON.parse(localStorage.getItem('tradescout:steel-home-project-tools:draft:v9')).cabinets.planner.shell;
          const scale = Math.min(620 / room.widthIn, 360 / room.depthIn);
          return { x: box.x + box.width / 2, y: box.y + box.height / 2, px: scale * matrix.a };
        });
        if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
        else { await page.mouse.move(p.x, p.y); await page.mouse.down(); }
        for (let step = 1; step <= 5; step++) {
          const x = p.x + inches * p.px * step / 5;
          if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: p.y }] });
          else await page.mouse.move(x, p.y);
        }
        assert.deepEqual(await read(), baseline, 'A camera-aware pointer move saved an intermediate design');
        if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
        await reportCabinetTouchTrace(page, key, { device, requestedInches: inches, start: p, endX: p.x + inches * p.px });
      };
      await dragBase(12);
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules.find(m => m.id === 'base').offsetIn === 12, key);
      const moved = await read();
      assert.equal(moved.cabinets.planner.modules.find(m => m.id === 'upper').offsetIn, 0);
      await click(button('Undo'));
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules.find(m => m.id === 'base').offsetIn === 0, key);
      assert.deepEqual(await read(), baseline);
      await dragBase(20);
      assert.deepEqual(await read(), baseline, 'A filtered-out panel must remain a collision blocker');
      assert((await page.getByTestId('cabinet-placement-status').innerText()).includes('Move not applied'));
      record(`${device}: precise zoomed movement`, 'A real mouse/touch 12-inch drag at non-default zoom saves once and fully undoes; moving 20 inches into a hidden end panel is rejected by full-model collision checks');

      const beforePan = await drawing.getAttribute('viewBox');
      const point = await drawing.evaluate(node => {
        const v = node.viewBox.baseVal, p = node.createSVGPoint(); p.x = v.x + v.width * .82; p.y = v.y + v.height * .88;
        const screen = p.matrixTransform(node.getScreenCTM()); return { x: screen.x, y: screen.y };
      });
      if (session) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - 25, y: point.y - 15 }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else { await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.mouse.move(point.x - 25, point.y - 15, { steps: 4 }); await page.mouse.up(); }
      assert.notEqual(await drawing.getAttribute('viewBox'), beforePan);
      assert.deepEqual(await read(), baseline);
      await click(button('Fit room')); assert.equal(await drawing.getAttribute('viewBox'), normalView);
      await page.getByLabel('Select object in plan', { exact: true }).selectOption('upper');
      assert.equal(await layer.inputValue(), 'all');
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.selectedModuleId === 'upper', key);
      record(`${device}: camera and object navigation`, 'Panning and Fit room alter no saved fields; the object picker exposes an upper cabinet even when the current layer excluded it');

      const beforeLibrary = await read();
      await click(button('Cabinet library'));
      await page.getByTestId('cabinet-visual-catalog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.cabinet-catalog-card').count(), 11);
      assert.equal(await page.locator('[data-testid="cabinet-library-drawer-bank"] [data-catalog-role="drawer"]').count(), 3);
      await page.screenshot({ path: path.join(working, `canvas-catalog-${device}.png`), fullPage: false });
      await page.getByLabel('Cabinet catalog group', { exact: true }).selectOption('base');
      assert.equal(await page.locator('.cabinet-catalog-card').count(), 4);
      assert.deepEqual(await read(), beforeLibrary);
      await click(page.getByTestId('cabinet-library-drawer-bank'));
      assert.equal(await page.getByTestId('cabinet-visual-catalog').getAttribute('data-compact'), 'true');
      assert.deepEqual(await read(), beforeLibrary);
      await click(button('Find wall space'));
      assert.equal(await page.getByTestId('cabinet-library-add').isDisabled(), false);
      await click(page.getByTestId('cabinet-library-add'));
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules.length === 5, key);
      await click(button('Undo'));
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules.length === 4, key);
      assert.deepEqual(await read(), beforeLibrary);
      record(`${device}: visual catalog to measured addition`, 'Eleven model-derived thumbnails, read-only group filtering and compact selected cards; gap proposal adds one cabinet and one Undo restores the whole prior project');

      await click(button('Edit selected dimensions'));
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'steel-home-cabinet-module-width');
      assert.equal(await page.getByTestId('cabinet-library-panel').count(), 0);
      assert.deepEqual(await read(), beforeLibrary);
      await drawing.scrollIntoViewIfNeeded();
      const withInspector = await drawing.boundingBox();
      await click(button('Focus drawing'));
      await drawing.scrollIntoViewIfNeeded();
      const focused = await drawing.boundingBox();
      if (device !== 'touch') assert(focused.width > withInspector.width + 300, 'Focus mode failed to enlarge the drawing');
      assert.deepEqual(await read(), beforeLibrary);
      await click(button('Fit selected'));
      await drawing.screenshot({ path: path.join(working, `canvas-closeup-${device}.png`) });
      await click(button('Fit room'));
      await page.screenshot({ path: path.join(working, `canvas-focus-${device}.png`), fullPage: false });
      await click(button('Show inspector'));
      assert.deepEqual(await read(), beforeLibrary);
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByTestId('cabinet-direct-placement').waitFor({ state: 'visible' });
      assert.deepEqual(await read(), beforeLibrary);
      assert.equal(await page.getByLabel('Cabinet plan zoom').innerText(), '100%');
      assert.equal(await page.getByLabel('Cabinet plan layer', { exact: true }).inputValue(), 'all');
      const bounds = await drawing.boundingBox();
      assert(bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
      assert.deepEqual(errors, []);
      record(`${device}: direct editing and focus`, { directWidthInputFocus: true, largerCanvas: focused, originalCanvas: withInspector, draftPreserved: true, reloadPreserved: true, cameraExcludedFromStorage: true, errors, blockedWrites: writes.length });
    } catch (error) {
      if (page) await reportCabinetTouchTrace(page, key, { device, failed: true }).catch(() => {});
      await page?.screenshot({ path: path.join(working, `canvas-failure-${device}.png`), fullPage: true }).catch(() => {});
      console.error('CANVAS_VISIBLE_TEXT ' + (await page?.locator('body').innerText().catch(() => '') || '').slice(0, 4500));
      throw error;
    } finally { await context.close(); }
  }
}
