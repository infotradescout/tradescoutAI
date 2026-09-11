import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function verifyCabinetAccessories({ browser, local, phase, deployed, working, record }) {
  const key = 'tradescout:steel-home-project-tools:draft:v9';
  const parentHtml = phase === 'preview' ? await fs.readFile('.kitchen-studio-review/cabinet-parent.html', 'utf8') : null;
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block', acceptDownloads: true,
      userAgent: `Mozilla/5.0 (${device === 'desktop' ? 'Windows NT 10.0; Win64; x64' : 'Linux; Android 13; Pixel 7'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} ${device === 'touch' ? 'Mobile ' : ''}Safari/537.36` });
    const blocked = [], errors = [];
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { blocked.push(new URL(request.url()).pathname); return route.abort('blockedbyclient'); }
      // The production parent uses pushState. The read-only local fixture server is not
      // an application router; serve the SAME compiled parent on local route reloads.
      // Production responses and build-marker assertions are never intercepted here.
      const url = new URL(request.url());
      if (parentHtml && request.isNavigationRequest() && url.origin === local && url.pathname.startsWith('/u/')) {
        return route.fulfill({ body: parentHtml, contentType: 'text/html' });
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); device === 'touch' ? await locator.tap() : await locator.click(); };
    const button = name => page.getByRole('button', { name, exact: true });
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const count = n => page.waitForFunction(({ key, n }) => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules.length === n, { key, n });
    const moduleValue = (id, field, value) => page.waitForFunction(({ key, id, field, value }) => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules.find(m => m.id === id)?.[field] === value, { key, id, field, value });
    const countertopPage = async () => {
      if (await page.getByTestId('steel-home-countertop-designer').count()) return;
      await click(page.getByTestId('steel-home-builder-close'));
      await click(page.getByTestId('steel-home-builder-open-countertops'));
      await page.getByTestId('steel-home-countertop-designer').waitFor({ state: 'visible' });
    };
    try {
      await page.goto(local, { waitUntil: 'networkidle' });
      await click(button('Load sample kitchen')); await count(3);
      const sample = await read(), source = sample.cabinets.planner.modules[0];
      sample.cabinets.notes = 'Earlier accessory outer notes';
      sample.cabinets.planner = { ...sample.cabinets.planner, starter: 'kitchen',
        shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
        modules: [{ ...source, id: 'a', label: 'Base A', offsetIn: 0 }, { ...source, id: 'b', label: 'Base B', offsetIn: 33 }],
        shellItems: [], selectedModuleId: 'a', view: 'plan', notes: 'PRIVATE accessory verification notes',
        presentation: { style: 'Shaker', finish: 'sage', hardware: 'Brushed brass', fronts: { a: 'doors', b: 'doors' } },
      };
      const destination = phase === 'production' ? 'https://www.thetradescout.com/u/steel-home-packages/builders/cabinets' : local + '/cabinet-parent.html';
      const initial = await page.goto(destination, { waitUntil: 'domcontentloaded' }); assert(initial?.ok());
      if (phase === 'production') assert.equal(initial.headers()['x-tradescout-build'], deployed);
      await page.getByTestId('steel-home-cabinet-designer').waitFor({ state: 'visible' });
      await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: sample });
      const response = await page.reload({ waitUntil: 'domcontentloaded' });
      if (phase === 'production') assert.equal(response.headers()['x-tradescout-build'], deployed);
      await page.getByTestId('cabinet-direct-placement').waitFor({ state: 'visible' }); await count(2);
      const baseline = await read();
      await click(button('Cabinet library'));
      await click(page.getByTestId('cabinet-accessory-filler'));
      await page.getByLabel('Library Offset from wall start in', { exact: true }).fill('30');
      assert.equal(await page.getByLabel('Library Depth in', { exact: true }).inputValue(), '0.75');
      assert.equal(await page.getByLabel('Library Wall setback in', { exact: true }).inputValue(), '23.25');
      assert.equal(await page.locator('[aria-label="Proposed cabinet front"] [data-casework-role="panel"]').count(), 1);
      assert.equal(await page.locator('[aria-label="Proposed cabinet front"] [data-casework-role="handle"]').count(), 0);
      assert.deepEqual(await read(), baseline);
      await click(button('Add to plan')); await count(3);
      const first = await read(), filler = first.cabinets.planner.modules.find(m => m.kind === 'filler');
      assert(filler); assert.equal(filler.depthIn, .75); assert.equal(filler.wallInsetIn, 23.25); assert.equal(filler.offsetIn, 30);
      assert.equal(first.cabinets.planner.presentation.fronts[filler.id], undefined);
      await click(button('Undo')); await count(2); assert.deepEqual(await read(), baseline);
      await click(button('Redo')); await count(3); assert.deepEqual(await read(), first);
      await click(button('Close library and schedule'));
      assert.equal(await page.getByLabel('Selected cabinet fronts', { exact: true }).count(), 0);
      await page.getByLabel('Selected accessory wall setback', { exact: true }).fill('22.5');
      assert.deepEqual(await read(), first);
      await click(button('Apply panel setback')); await moduleValue(filler.id, 'wallInsetIn', 22.5);
      const movedSetback = await read();
      await click(button('Undo')); await moduleValue(filler.id, 'wallInsetIn', 23.25); assert.deepEqual(await read(), first);
      await click(button('Redo')); await moduleValue(filler.id, 'wallInsetIn', 22.5); assert.deepEqual(await read(), movedSetback);
      await click(button('Undo')); await moduleValue(filler.id, 'wallInsetIn', 23.25);
      await page.getByLabel('Selected accessory wall setback', { exact: true }).fill('1000');
      assert.equal(await button('Apply panel setback').isDisabled(), true); assert.deepEqual(await read(), first);
      await page.getByLabel('Selected accessory wall setback', { exact: true }).fill('23.25');
      record(`${device}: exact filler and reversible setback`, 'Thin filler retains 0.75-inch actual depth and explicit wall setback; preview makes no writes; full-project Add/Undo/Redo and setback Undo/Redo work; no cabinet front or hardware assigned; invalid setback blocked');

      await click(button('Cabinet library')); await click(page.getByTestId('cabinet-accessory-end-panel'));
      assert.equal(await button('Add to plan').isDisabled(), true);
      await page.getByLabel('Library Offset from wall start in', { exact: true }).fill('63');
      await click(button('Add to plan')); await count(4);
      await click(button('Close library and schedule'));
      const four = await read(), endPanel = four.cabinets.planner.modules.find(m => m.kind === 'end-panel');
      assert(endPanel); assert.equal(endPanel.widthIn, .75); assert.equal(endPanel.depthIn, 24);
      await page.locator(`[data-module="${endPanel.id}"]`).focus(); await page.keyboard.press('ArrowRight');
      await moduleValue(endPanel.id, 'offsetIn', 63.125);
      await click(button('Undo')); await moduleValue(endPanel.id, 'offsetIn', 63); assert.deepEqual(await read(), four);
      await click(button('Duplicate selected')); await count(5);
      const five = await read();
      assert.equal(five.cabinets.planner.modules.filter(m => m.kind === 'end-panel').length, 2);
      assert.equal(five.cabinets.planner.modules[4].offsetIn, 63.75);
      assert.deepEqual(five.countertops, baseline.countertops); assert.deepEqual(five.building, baseline.building);
      await click(button('Cabinet schedule'));
      assert.equal(await page.getByTestId('cabinet-schedule-count').innerText(), '2 cabinets · 0 appliance spaces · 3 accessories');
      const row = page.getByTestId('cabinet-schedule-row').filter({ hasText: 'Finished end panel' });
      assert.equal(await row.locator('td').first().innerText(), '2');
      assert.equal(await page.locator('[data-testid="cabinet-schedule-elevation-north"] [data-casework-role="panel"]').count(), 3);
      const downloading = page.waitForEvent('download'); await click(button('Export cabinet schedule'));
      const download = await downloading; assert.equal(await download.failure(), null);
      const csvPath = path.join(working, `accessories-${device}.csv`); await download.saveAs(csvPath);
      const csv = await fs.readFile(csvPath, 'utf8');
      assert(csv.includes('"2","Finished end panel","end-panel","0.75","24","34.5"'));
      assert(csv.includes('wall setback 23.25')); assert(!csv.includes('PRIVATE') && !csv.includes('Earlier accessory'));
      await page.getByTestId('cabinet-library-panel').screenshot({ path: path.join(working, `accessory-schedule-${device}.png`) });
      await click(button('Close library and schedule'));
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByTestId('cabinet-direct-placement').waitFor({ state: 'visible' });
      assert.deepEqual(await read(), five);
      await click(page.getByTestId('steel-home-cabinet-view-3d'));
      await page.getByTestId('steel-home-cabinet-three-preview').locator('canvas').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); assert.equal(await page.getByText('3D room unavailable', { exact: true }).count(), 0);
      await click(button('Reset view'));
      await page.getByTestId('steel-home-cabinet-three-preview').screenshot({ path: path.join(working, `accessory-room-${device}.png`) });
      record(`${device}: end panels, counts and saved views`, 'Panel collision rejected; exact eighth-inch movement and Undo work; duplicate retains accessory identity; two cabinets remain two cabinets with three separately counted accessories; CSV and elevations agree; full draft survives reload; 3D is available');

      await countertopPage();
      const beforePreview = await read();
      await click(button('Use cabinet layout'));
      await page.getByLabel('Wall-run front overhang (in)', { exact: true }).fill('1.5');
      await page.getByLabel('Countertop thickness (in)', { exact: true }).fill('1.25');
      assert.equal(await page.getByTestId('apply-cabinet-countertop-import').isDisabled(), true);
      assert((await page.getByTestId('cabinet-countertop-import').innerText()).includes('gap'));
      assert.equal(await page.locator('[data-transfer-shape="support"]').count(), 2);
      assert.equal(await page.locator('[data-transfer-shape="excluded"]').count(), 3);
      assert.deepEqual(await read(), beforePreview);
      // Independent synthetic second case: contiguous cabinet supports with panels outside the run.
      const continuous = structuredClone(beforePreview);
      continuous.cabinets.planner.modules = continuous.cabinets.planner.modules.map(m => m.id === 'b' ? { ...m, offsetIn: 30 } : m.kind === 'filler' ? { ...m, offsetIn: 60 } : m);
      continuous.cabinets.planner.view = 'plan';
      await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: continuous });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('steel-home-packages-profile').waitFor({ state: 'visible' });
      if (phase === 'preview') { await page.getByTestId('steel-home-cabinet-designer').waitFor({ state: 'visible' }); }
      else { await page.getByTestId('steel-home-countertop-designer').waitFor({ state: 'visible' }); }
      await countertopPage();
      const beforeImport = await read();
      await click(button('Use cabinet layout'));
      await page.getByLabel('Wall-run front overhang (in)', { exact: true }).fill('1.5');
      await page.getByLabel('Countertop thickness (in)', { exact: true }).fill('1.25');
      assert.equal(await page.locator('[data-transfer-shape="support"]').count(), 2);
      assert.equal(await page.locator('[data-transfer-shape="excluded"]').count(), 3);
      await page.getByTestId('cabinet-countertop-import').screenshot({ path: path.join(working, `accessory-handoff-${device}.png`) });
      await click(page.getByLabel('Approve countertop replacement', { exact: true }));
      await click(page.getByTestId('apply-cabinet-countertop-import'));
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).countertops.wallAIn === 60, key);
      const imported = await read();
      assert.equal(imported.countertops.wallDepthIn, 25.5);
      assert.deepEqual(imported.cabinets, beforeImport.cabinets);
      await click(button('Undo'));
      await page.waitForFunction(({ key, a }) => JSON.parse(localStorage.getItem(key)).countertops.wallAIn === a, { key, a: beforeImport.countertops.wallAIn });
      assert.deepEqual(await read(), beforeImport);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
      record(`${device}: countertop support separation`, 'A face filler did not cover a support gap; gap import blocked without writes. Contiguous supports imported exactly 60 inches with all three panels excluded, original cabinets preserved and full import Undo working; no page errors or horizontal overflow');
      console.log('ACCESSORY_BLOCKED_WRITES ' + JSON.stringify({ device, paths: blocked }));
    } catch (error) {
      await page.screenshot({ path: path.join(working, `accessory-failure-${device}.png`), fullPage: true }).catch(() => {});
      console.error('ACCESSORY_VISIBLE_TEXT ' + (await page.locator('body').innerText().catch(() => '')).slice(0, 5000));
      throw error;
    } finally { await context.close(); }
  }
}
