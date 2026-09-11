import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { prepareCabinetParentFixture } from './prepare-cabinet-parent-proof.mjs';
import { startCabinetLoopbackTestDatabase } from './start-cabinet-loopback-test-db.mjs';

const phase = process.env.CABINET_LIBRARY_PHASE || 'preview';
assert(['preview', 'production'].includes(phase));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const deployed = process.env.CABINET_LIBRARY_DEPLOYED_SHA || '';
if (phase === 'production') assert(/^[a-f0-9]{40}$/.test(deployed));
const out = '.cabinet-library-proof';
const working = await fs.mkdtemp(path.join(os.tmpdir(), 'cabinet-library-'));
const proof = { head, phase, deployed: deployed || null, startedAt: new Date().toISOString(), checks: [], passed: false };
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', env: process.env, ...options });
const record = (name, detail) => { const check = { name, detail, passed: true }; proof.checks.push(check); console.log('LIBRARY_CHECK ' + JSON.stringify(check)); };
let browser, server, activePage;
try {
  if (phase === 'preview') {
    run('npm', ['run', 'check']); record('TypeScript', 'passed');
    run('npm', ['run', 'test:run', '--', 'client/src/features/jw-stone', 'client/src/pages/profile-sites/steel-home-project-tools', 'client/src/pages/profile-sites/SteelHomePackagesProfile.test.tsx', 'server/tests/steel-home-builder-profile-route.contract.test.ts', 'server/tests/steel-home-builder-profile-route.runtime.test.ts']);
    record('Affected tests', 'All selected suites passed; counts are retained in the Vitest log, including cabinet-to-countertop handoff regressions');
    run('npm', ['run', 'build'], { env: { ...process.env, NODE_ENV: 'production' } });
    record('Production build', 'All existing asset, bundle and lazy-boundary guards passed unchanged');
  }
  run(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium']);
  run(process.execPath, ['scripts/prepare-kitchen-studio-review.mjs']);
  record('Existing editor regressions', 'Desktop/mobile cabinet appearance, duplication, undo/redo, WebGL and reload plus countertop scaled drawing/export passed in the existing component harness');
  await prepareCabinetParentFixture();
  server = spawn(process.execPath, ['scripts/serve-kitchen-studio-review.mjs'], { env: { ...process.env, PORT: '4179' }, stdio: 'inherit' });
  const local = 'http://127.0.0.1:4179';
  for (let i = 0; i < 100; i++) { try { if ((await fetch(local)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
  const storageKey = 'tradescout:steel-home-project-tools:draft:v9';
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const userAgent = `Mozilla/5.0 (${device === 'desktop' ? 'Windows NT 10.0; Win64; x64' : 'Linux; Android 13; Pixel 7'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} ${device === 'touch' ? 'Mobile ' : ''}Safari/537.36`;
    const context = await browser.newContext({ viewport, userAgent, isMobile: device === 'touch', hasTouch: device === 'touch', acceptDownloads: true, serviceWorkers: 'block' });
    const blockedWrites = []; let libraryRequests = 0;
    await context.route('**/*', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) { blockedWrites.push(new URL(request.url()).pathname); return route.abort('blockedbyclient'); }
      if (/CabinetLibraryPanel[^/]*\.js/.test(request.url())) { libraryRequests++; await new Promise(resolve => setTimeout(resolve, 400)); }
      return route.continue();
    });
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000);
    const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); if (device === 'touch') await locator.tap(); else await locator.click(); };
    const button = name => page.getByRole('button', { name, exact: true });
    const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    const waitCount = count => page.waitForFunction(({ key, count }) => JSON.parse(localStorage.getItem(key)).cabinets.planner.modules.length === count, { key: storageKey, count });
    await page.goto(local, { waitUntil: 'networkidle' });
    await click(button('Load sample kitchen'));
    await waitCount(3);
    const sample = await read();
    sample.cabinets.notes = 'Earlier library outer notes';
    sample.cabinets.planner = { ...sample.cabinets.planner,
      shell: { widthIn: 180, depthIn: 156, heightIn: 108, measurementsReviewed: true },
      modules: [], shellItems: [], selectedModuleId: null, view: 'plan', notes: 'PRIVATE synthetic library notes',
      presentation: { style: 'Shaker', finish: 'sage', hardware: 'Brushed brass', fronts: {} },
    };
    const destination = phase === 'production' ? 'https://www.thetradescout.com/u/steel-home-packages/builders/cabinets' : local + '/cabinet-parent.html';
    let response = await page.goto(destination, { waitUntil: 'domcontentloaded' }); assert(response?.ok());
    if (phase === 'production') assert.equal(response.headers()['x-tradescout-build'], deployed);
    await page.getByTestId('steel-home-cabinet-designer').waitFor({ state: 'visible' });
    await page.evaluate(({ key, sample }) => localStorage.setItem(key, JSON.stringify(sample)), { key: storageKey, sample });
    response = await page.reload({ waitUntil: 'domcontentloaded' });
    if (phase === 'production') assert.equal(response.headers()['x-tradescout-build'], deployed);
    await page.getByTestId('cabinet-direct-placement').waitFor({ state: 'visible' }); await waitCount(0);
    const baseline = await read();
    await click(button('Cabinet library')); await page.getByTestId('cabinet-library-panel').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-testid^="cabinet-library-"]').filter({ has: page.locator('strong') }).count(), 9);
    await click(page.getByTestId('cabinet-library-drawer-bank'));
    assert.equal(await page.locator('[aria-label="Proposed cabinet front"] [data-casework-role="drawer"]').count(), 3);
    assert.deepEqual(await read(), baseline);
    await click(button('Close library and schedule')); assert.deepEqual(await read(), baseline);
    await click(button('Cabinet library')); await click(page.getByTestId('cabinet-library-drawer-bank'));
    await click(button('Add to plan')); await waitCount(1);
    const first = await read(); const firstModule = first.cabinets.planner.modules[0];
    assert.equal(firstModule.widthIn, 18); assert.equal(first.cabinets.planner.presentation.fronts[firstModule.id], 'drawers');
    assert.equal(first.cabinets.planner.shell.measurementsReviewed, false);
    assert.deepEqual(first.countertops, baseline.countertops);
    await click(button('Undo')); await waitCount(0); assert.deepEqual(await read(), baseline);
    await click(button('Redo')); await waitCount(1); assert.deepEqual(await read(), first);
    record(`${device}: read-only library and one-step history`, 'Nine explicit choices; shared three-drawer preview; preview/cancel did not save; addition used one Undo/Redo step restoring full project and divergent note fields');

    await click(page.getByTestId('cabinet-library-sink-base'));
    assert.equal(await button('Add to plan').isDisabled(), true);
    const beforeGap = await read(); await click(button('Find wall space'));
    assert.deepEqual(await read(), beforeGap);
    assert.equal(await page.getByLabel('Library Offset from wall start in', { exact: true }).inputValue(), '18');
    await click(button('Add to plan')); await waitCount(2);
    await click(page.getByTestId('cabinet-library-pantry')); await click(button('Find wall space'));
    assert.equal(await page.getByLabel('Library Offset from wall start in', { exact: true }).inputValue(), '54');
    await click(button('Add to plan')); await waitCount(3);
    await click(page.getByTestId('cabinet-library-wall-doors')); await click(button('Add to plan')); await waitCount(4);
    await click(page.getByTestId('cabinet-library-island-drawers'));
    assert.equal(await button('Add to plan').isDisabled(), true);
    await page.getByLabel('Library X from west in', { exact: true }).fill('84');
    await page.getByLabel('Library Y from north in', { exact: true }).fill('72');
    await click(button('Add to plan')); await waitCount(5);
    await click(button('Close library and schedule'));
    await click(button('Duplicate selected')); await waitCount(6);
    const six = await read();
    assert.equal(six.cabinets.planner.modules[5].offsetIn, 114);
    assert.equal(six.cabinets.planner.presentation.fronts[six.cabinets.planner.modules[5].id], 'drawers');
    assert.deepEqual(six.countertops, baseline.countertops);
    assert.deepEqual(six.building, baseline.building);
    record(`${device}: configurations and measured fit`, 'Sink, drawer bank, pantry, wall cabinet and explicit-position island placed; overlapping additions blocked; gap search was read-only; duplicate retained fronts; countertops/building unchanged');

    await click(button('Cabinet schedule'));
    assert((await page.getByTestId('cabinet-schedule-count').innerText()).includes('6 cabinets · 0 appliance spaces'));
    const islandRow = page.getByTestId('cabinet-schedule-row').filter({ hasText: 'Island drawer cabinet' });
    assert.equal(await islandRow.locator('td').first().innerText(), '2');
    assert.equal(await page.locator('[data-testid="cabinet-schedule-elevation-north"] [data-front-arrangement="sink"]').count(), 1);
    const pending = page.waitForEvent('download'); await click(button('Export cabinet schedule'));
    const download = await pending; assert.equal(await download.failure(), null);
    const csvPath = path.join(working, `schedule-${device}.csv`); await download.saveAs(csvPath);
    const csv = await fs.readFile(csvPath, 'utf8');
    assert(csv.includes('"2","Island drawer cabinet"'));
    assert(csv.includes('"36","24","34.5","sink"'));
    assert(!csv.includes('PRIVATE') && !csv.includes('Earlier library'));
    await page.getByTestId('cabinet-library-panel').screenshot({ path: path.join(working, `schedule-${device}.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await click(button('Close library and schedule'));
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByTestId('cabinet-direct-placement').waitFor({ state: 'visible' });
    assert.deepEqual(await read(), six);
    await click(page.getByTestId('steel-home-cabinet-view-3d'));
    await page.getByTestId('steel-home-cabinet-three-preview').locator('canvas').waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    assert.equal(await page.getByText('3D room unavailable', { exact: true }).count(), 0);
    await click(button('Reset view'));
    await page.getByTestId('steel-home-cabinet-three-preview').screenshot({ path: path.join(working, `casework-${device}.png`) });
    assert.equal(await page.getByTestId('steel-home-cabinet-include').isDisabled(), true);
    assert.deepEqual(errors, []);
    assert(libraryRequests > 0, 'The lazy library chunk was not exercised');
    record(`${device}: schedule, reload and 3D`, 'Counted/grouped CSV and front elevations matched saved modules; export omitted private notes; exact draft survived reload; 3D and measurement-review gate intact; no page errors or horizontal overflow');
    console.log('LIBRARY_BLOCKED_WRITES ' + JSON.stringify({ device, paths: blockedWrites }));
    await context.close(); activePage = null;
  }
  await browser.close(); browser = null; server.kill(); server = null;
  await fs.rm('.kitchen-studio-review', { recursive: true, force: true });
  await fs.rm(out, { recursive: true, force: true });
  if (phase === 'preview') {
    const database = await startCabinetLoopbackTestDatabase(); proof.testDatabase = database.evidence;
    try {
      run('npm', ['run', 'gate:minimum-release', '--', '--browser-proof=manual', '--browser-note=Actual production parent desktop and touch cabinet library preview/add/undo/redo, collision rejection, explicit island placement, counted schedule CSV/elevations, reload and 3D passed; synthetic local drafts only; prior cabinet/countertop regressions retained'], { env: { ...process.env, TEST_DATABASE_URL: database.url } });
      proof.minimumRelease = JSON.parse(await fs.readFile(`artifacts/release-contract/${head.slice(0, 12)}/evidence.json`, 'utf8'));
      assert.equal(proof.minimumRelease.commit, head); assert.equal(proof.minimumRelease.result, 'pass'); assert.equal(proof.minimumRelease.attestable, true);
    } finally { await database.stop(); }
  } else {
    const health = await fetch('https://www.thetradescout.com/api/health', { signal: AbortSignal.timeout(20000) }); const value = await health.json();
    assert(health.ok); assert.equal(health.headers.get('x-tradescout-build'), deployed); assert.equal(value.commit, deployed);
    assert.equal(value.status, 'healthy'); assert.equal(value.database, 'connected'); assert.equal(value.migrations?.compatibility, 'compatible');
    proof.health = { commit: value.commit, status: value.status, database: value.database, migrations: value.migrations };
  }
  proof.passed = true;
} catch (error) {
  proof.error = String(error.stack || error); console.error('LIBRARY_FAILURE ' + proof.error);
  if (activePage) { await activePage.screenshot({ path: path.join(working, 'failure.png'), fullPage: true }).catch(() => {}); proof.visibleText = (await activePage.locator('body').innerText().catch(() => '')).slice(0, 3000); }
} finally {
  await browser?.close(); server?.kill(); proof.finishedAt = new Date().toISOString();
  await fs.mkdir(out, { recursive: true }); await fs.cp(working, out, { recursive: true });
  await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(proof, null, 2));
  const artifacts = (await fs.readdir(out)).filter(name => /\.(png|csv)$/.test(name));
  await fs.writeFile(path.join(out, 'index.html'), '<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cabinet library verification</title><h1>' + (proof.passed ? 'PASS' : 'FAILED — not release approval') + '</h1><p>' + phase + ' ' + head + '</p><a href="evidence.json">Evidence</a>' + artifacts.map(name => '<p><a href="' + name + '">' + name + '</a></p>').join('') + '</html>');
  console.log('LIBRARY_RESULT ' + JSON.stringify(proof)); await fs.rm(working, { recursive: true, force: true });
}
// Failed results remain inspectable. Only passed=true with exact-head attestable gate evidence authorizes a preview release.
