import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';

const phase = process.env.CABINET_PLACEMENT_PHASE || 'preview';
assert(['preview', 'production'].includes(phase));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const deployed = process.env.CABINET_PLACEMENT_DEPLOYED_SHA || '';
if (phase === 'production') assert(/^[a-f0-9]{40}$/.test(deployed));
const base = 'e4bd41b74e03c2c8c405030b3bb7aee47eabac12';
const out = '.cabinet-placement-proof';
const working = await fs.mkdtemp(path.join(os.tmpdir(), 'cabinet-placement-'));
const proof = { head, phase, deployed: deployed || null, startedAt: new Date().toISOString(), checks: [], passed: false };
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: 'inherit', env: process.env, ...options });
const record = (name, detail) => { const check = { name, detail, passed: true }; proof.checks.push(check); console.log('CABINET_CHECK ' + JSON.stringify(check)); };
let browser, server, activePage;
try {
  if (phase === 'preview') {
    try { execFileSync('git', ['cat-file', '-e', base]); } catch { run('git', ['fetch', '--no-tags', 'origin', base]); }
    const file = 'client/src/pages/profile-sites/steel-home-project-tools/CabinetMeasuredEditor.tsx';
    let original = execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' });
    const start = original.indexOf('function PlanView({'), end = original.indexOf('function WallElevation({');
    assert(start > 0 && end > start);
    original = original.slice(0, start) + original.slice(end);
    original = original.replace('import CabinetThreePreview from "./CabinetThreePreview";', 'import CabinetThreePreview from "./CabinetThreePreview";\nimport PlanView from "./CabinetPlanView";')
      .replace('  getCabinetModuleBounds,\n', '')
      .replace('<PlanView planner={planner} onSelectModule={selectModule} />', '<PlanView planner={planner} onSelectModule={selectModule} onChange={commitGeometry} />');
    assert.equal((await fs.readFile(file, 'utf8')).trimEnd(), original.trimEnd(), 'Existing measured controls changed beyond plan extraction/integration');
    record('Existing editor preservation', 'All existing measurements, requests, fields, elevations and 3D code are byte-identical outside the direct-plan extraction and one callback');
    run('npm', ['run', 'check']); record('TypeScript', 'passed');
    run('npm', ['run', 'test:run', '--', 'client/src/features/jw-stone', 'client/src/pages/profile-sites/steel-home-project-tools', 'client/src/pages/profile-sites/SteelHomePackagesProfile.test.tsx', 'server/tests/steel-home-builder-profile-route.contract.test.ts', 'server/tests/steel-home-builder-profile-route.runtime.test.ts']);
    record('Affected tests', 'All selected suites passed; counts recorded by Vitest');
    run('npm', ['run', 'build'], { env: { ...process.env, NODE_ENV: 'production' } });
    record('Production build', 'Existing bundle, asset and lazy-load guards passed unchanged');
  }
  run(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium']);
  run(process.execPath, ['scripts/prepare-kitchen-studio-review.mjs']);
  record('Existing cabinet/countertop workflows', 'Desktop/mobile appearance, duplicate, undo/redo, 3D, reload, scaled drawing and SVG export component regressions passed');
  server = spawn(process.execPath, ['scripts/serve-kitchen-studio-review.mjs'], { env: { ...process.env, PORT: '4179' }, stdio: 'inherit' });
  const local = 'http://127.0.0.1:4179';
  for (let n = 0; n < 100; n++) { try { if ((await fetch(local)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
  const key = 'tradescout:steel-home-project-tools:draft:v9';
  const origin = phase === 'production' ? 'https://www.thetradescout.com' : local;
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const userAgent = `Mozilla/5.0 (${device === 'desktop' ? 'Windows NT 10.0; Win64; x64' : 'Linux; Android 13; Pixel 7'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} ${device === 'touch' ? 'Mobile ' : ''}Safari/537.36`;
    const context = await browser.newContext({ viewport, userAgent, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block', acceptDownloads: true });
    const writes = [];
    await context.route('**/*', async route => {
      const req = route.request();
      if (!['GET', 'HEAD'].includes(req.method())) { writes.push({ method: req.method(), path: new URL(req.url()).pathname }); return route.abort('blockedbyclient'); }
      return route.continue();
    });
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000);
    const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); await locator.click(); };
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    await page.goto(local, { waitUntil: 'networkidle' });
    await click(page.getByRole('button', { name: 'Load sample kitchen', exact: true }));
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || 'null')?.cabinets?.planner?.modules?.length === 3, key);
    const sample = await read();
    const source = sample.cabinets.planner.modules[0];
    sample.cabinets.planner = { ...sample.cabinets.planner, shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true }, view: 'plan', selectedModuleId: 'a', notes: 'Synthetic cabinet placement note',
      modules: [
        { ...source, id: 'a', label: 'Base A', offsetIn: 0 },
        { ...source, id: 'b', label: 'Base B', offsetIn: 60 },
        { ...source, id: 'east', label: 'East base', surface: 'east', offsetIn: 36 },
        { ...source, id: 'island', label: 'Island', kind: 'island', surface: 'floor', widthIn: 36, offsetIn: 60, roomDepthOffsetIn: 60 },
      ],
      shellItems: [{ id: 'door', kind: 'door', label: 'Door', wall: 'north', offsetIn: 120, widthIn: 30, heightIn: 80, elevationIn: 0, depthIn: 4 }],
      presentation: { style: 'Shaker', finish: 'sage', hardware: 'Brushed brass', fronts: { a: 'drawers', b: 'doors', east: 'doors', island: 'drawers' } },
    };
    const destination = phase === 'production' ? origin + '/u/steel-home-packages/builders/cabinets' : local;
    if (phase === 'production') {
      const response = await page.goto(destination, { waitUntil: 'domcontentloaded' });
      assert(response?.ok()); assert.equal(response.headers()['x-tradescout-build'], deployed);
      await page.getByTestId('steel-home-cabinet-designer').waitFor({ state: 'visible' });
    }
    await page.evaluate(({ key, sample }) => localStorage.setItem(key, JSON.stringify(sample)), { key, sample });
    const response = await page.reload({ waitUntil: 'domcontentloaded' });
    if (phase === 'production') assert.equal(response.headers()['x-tradescout-build'], deployed);
    await page.getByTestId('cabinet-direct-placement').waitFor({ state: 'visible' });
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules[0].id === 'a', key);
    const baseline = await read();
    const item = id => page.locator(`[data-module="${id}"]`);
    const waitPosition = (id, offset, z) => page.waitForFunction(({ key, id, offset, z }) => {
      const module = JSON.parse(localStorage.getItem(key)).cabinets.planner.modules.find(m => m.id === id);
      return module.offsetIn === offset && (z === undefined || module.roomDepthOffsetIn === z);
    }, { key, id, offset, z });
    const session = device === 'touch' ? await context.newCDPSession(page) : null;
    let start;
    const begin = async id => {
      await item(id).scrollIntoViewIfNeeded();
      start = await item(id).evaluate(node => {
        const rect = node.querySelector('rect').getBoundingClientRect(); const svg = node.ownerSVGElement;
        const m = svg.getScreenCTM(); const room = JSON.parse(localStorage.getItem('tradescout:steel-home-project-tools:draft:v9')).cabinets.planner.shell;
        const scale = Math.min(620 / room.widthIn, 360 / room.depthIn);
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, ax: m.a * scale, ay: m.b * scale, zx: m.c * scale, zy: m.d * scale };
      });
      if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }] });
      else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    };
    const move = async (dx, dz) => {
      for (let n = 1; n <= 6; n++) {
        const x = start.x + (dx * start.ax + dz * start.zx) * n / 6;
        const y = start.y + (dx * start.ay + dz * start.zy) * n / 6;
        if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        else await page.mouse.move(x, y);
      }
    };
    const end = async () => { if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up(); };
    await begin('a'); await move(29.5, 0);
    assert.equal(await item('a').getAttribute('data-offset-in'), '30', 'Snap preview did not use measured target');
    assert(await page.locator('[data-snap-guide]').count(), 'Snap guide not visible');
    assert.deepEqual(await read(), baseline, 'Pointer movement wrote an intermediate draft');
    await page.getByTestId('cabinet-direct-placement').screenshot({ path: path.join(working, `snap-${device}.png`) });
    await end(); await waitPosition('a', 30);
    assert.equal((await read()).cabinets.planner.shell.measurementsReviewed, false);
    await click(page.getByRole('button', { name: 'Undo', exact: true })); await waitPosition('a', 0);
    assert.deepEqual(await read(), baseline, 'One undo did not restore the entire pre-drag draft');
    await click(page.getByRole('button', { name: 'Redo', exact: true })); await waitPosition('a', 30);
    record(`${device}: snap and single-step undo`, 'Real pointer movement previewed at 30 inches without writing; drop committed; one Undo restored the entire original draft and review flag; Redo restored placement');

    const beforeBlocked = await read();
    await begin('a'); await move(20, 0);
    assert.equal(await page.getByTestId('steel-home-cabinet-plan').getAttribute('data-placement-invalid'), 'true');
    await page.getByTestId('cabinet-direct-placement').screenshot({ path: path.join(working, `collision-${device}.png`) });
    await end();
    assert.deepEqual(await read(), beforeBlocked);
    assert((await page.getByTestId('cabinet-placement-status').textContent()).includes('Move not applied'));
    await begin('a'); await move(-15, 0); await page.keyboard.press('Escape'); await end();
    assert.deepEqual(await read(), beforeBlocked, 'Escape changed the draft');
    await begin('a'); await move(-15, 0);
    if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    else { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await end(); }
    assert.deepEqual(await read(), beforeBlocked, 'Interrupted pointer changed the draft');
    record(`${device}: blocked and cancelled moves`, 'Collision preview blocked on release; Escape and pointer interruption preserved the entire saved draft');

    await item('a').focus(); await page.keyboard.press('ArrowLeft'); await waitPosition('a', 29.875);
    await page.keyboard.press('Shift+ArrowLeft'); await waitPosition('a', 28.875);
    await click(page.getByRole('button', { name: 'Move selected cabinet left', exact: true })); await waitPosition('a', 28.75);
    await click(page.locator('summary').filter({ hasText: '3. Cabinet, appliance, and island modules' }));
    const field = page.getByTestId('steel-home-cabinet-module-offset'); await field.scrollIntoViewIfNeeded(); await field.fill('25'); await waitPosition('a', 25);
    await click(page.getByLabel('Snap to walls and cabinets', { exact: true }));
    await begin('a'); await move(4.5, 0); await end(); await waitPosition('a', 29.5);
    record(`${device}: exact positioning`, 'Eighth-inch arrows, one-inch shifted arrows, accessible movement buttons and original numeric inputs agree; magnet toggle leaves grid precision intact');

    await begin('east'); await move(0, 12); await end(); await waitPosition('east', 48);
    await begin('island'); await move(24, 12); await end(); await waitPosition('island', 84, 72);
    const final = await read();
    assert.deepEqual(final.countertops, baseline.countertops, 'Cabinet editing changed countertop design');
    assert.deepEqual(final.cabinets.planner.presentation, baseline.cabinets.planner.presentation);
    assert.equal(final.cabinets.planner.notes, baseline.cabinets.planner.notes);
    assert.equal(await page.getByTestId('steel-home-cabinet-include').isDisabled(), true, 'Review gate was bypassed by movement');
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByTestId('cabinet-direct-placement').waitFor({ state: 'visible' });
    assert.deepEqual(await read(), final, 'Reload changed the moved design');
    await page.getByTestId('cabinet-direct-placement').screenshot({ path: path.join(working, `plan-${device}.png`) });
    await click(page.getByTestId('steel-home-cabinet-view-elevations')); await page.getByTestId('steel-home-cabinet-elevation-east').waitFor({ state: 'visible' });
    await click(page.getByTestId('steel-home-cabinet-view-3d')); await page.getByTestId('steel-home-cabinet-three-preview').locator('canvas').waitFor({ state: 'visible' });
    await page.waitForTimeout(400); assert.equal(await page.getByText('3D room unavailable', { exact: true }).count(), 0);
    await click(page.getByRole('button', { name: 'Reset view', exact: true }));
    await page.getByTestId('steel-home-cabinet-three-preview').screenshot({ path: path.join(working, `room-${device}.png`) });
    await click(page.getByRole('button', { name: 'Dimensioned review', exact: true }));
    assert((await page.getByRole('region', { name: 'Cabinet dimensioned review' }).textContent()).includes('29.5'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    assert.deepEqual(errors, []);
    record(`${device}: room and saved-design integration`, 'L-shaped cabinet layout and two-axis island movements survived reload; appearance, notes and countertops preserved; elevations, 3D, review and request gate work; no page errors or horizontal overflow');
    console.log('CABINET_BLOCKED_WRITES ' + JSON.stringify({ device, writes }));
    await context.close(); activePage = null;
  }
  await browser.close(); browser = null; server.kill(); server = null;
  await fs.rm('.kitchen-studio-review', { recursive: true, force: true });
  await fs.rm(out, { recursive: true, force: true });
  if (phase === 'preview') {
    assert(process.env.TEST_DATABASE_URL, 'Disposable verification database is required');
    run('npm', ['run', 'gate:minimum-release', '--', '--browser-proof=manual', '--browser-note=Real desktop mouse and mobile CDP touch dragging, snap guides, single-step undo/redo, collisions, Escape, pointer interruption, numeric and keyboard positioning, L-layout and island reload passed on this exact head; no customer requests submitted']);
    proof.minimumRelease = JSON.parse(await fs.readFile(`artifacts/release-contract/${head.slice(0, 12)}/evidence.json`, 'utf8'));
    assert.equal(proof.minimumRelease.commit, head); assert.equal(proof.minimumRelease.result, 'pass'); assert.equal(proof.minimumRelease.attestable, true);
  } else {
    const health = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(20000) }); const value = await health.json();
    assert(health.ok); assert.equal(health.headers.get('x-tradescout-build'), deployed); assert.equal(value.commit, deployed);
    assert.equal(value.status, 'healthy'); assert.equal(value.database, 'connected'); assert.equal(value.migrations?.compatibility, 'compatible');
    proof.health = { commit: value.commit, status: value.status, database: value.database, migrations: value.migrations };
  }
  proof.passed = true;
} catch (error) {
  proof.error = String(error.stack || error); console.error('CABINET_FAILURE ' + proof.error);
  if (activePage) { await activePage.screenshot({ path: path.join(working, 'failure.png'), fullPage: true }).catch(() => {}); proof.visibleText = (await activePage.locator('body').innerText().catch(() => '')).slice(0, 4000); }
} finally {
  await browser?.close(); server?.kill();
  proof.finishedAt = new Date().toISOString();
  await fs.mkdir(out, { recursive: true }); await fs.cp(working, out, { recursive: true });
  await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(proof, null, 2));
  const images = (await fs.readdir(out)).filter(name => name.endsWith('.png'));
  await fs.writeFile(path.join(out, 'index.html'), '<!doctype html><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cabinet placement verification</title><h1>' + (proof.passed ? 'PASS' : 'FAILED — not release approval') + '</h1><p>' + phase + ' ' + head + '</p><a href="evidence.json">Evidence</a>' + images.map(name => '<p><a href="' + name + '">' + name + '</a></p>').join(''));
  console.log('CABINET_RESULT ' + JSON.stringify(proof)); await fs.rm(working, { recursive: true, force: true });
}
// Failed reports remain publishable; only the exact-head passed verdict and attestable gate authorize release.
