import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const root = process.cwd();
const origin = 'https://www.thetradescout.com';
const mode = process.env.ISSA_PROOF_MODE || 'preview';
assert.ok(['preview', 'production'].includes(mode));
const base = '38ffc9422faa20967aa7c9f982a434287a403b04';
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.join(root, '.issa-footer-proof');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'issa-footer-proof-'));
await fs.mkdir(output, { recursive: true });
const env = { ...process.env };
for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'BASE_URL', 'APP_URL', 'SKIP_NPM_CI', 'SKIP_TEST_DB_BOOTSTRAP']) delete env[key];
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, stdio: 'inherit', env, ...options });
const result = { source: head, mode, startedAt: new Date().toISOString(), passed: false, negativeControl: null, minimumRelease: null, pages: [], discovery: [] };
const testFile = 'server/tests/issa-footer-discovery.test.tsx';
const configText = `import {defineConfig} from 'vitest/config';import path from 'node:path';export default defineConfig({resolve:{alias:{'@':path.resolve('client/src'),'@shared':path.resolve('shared')}},test:{environment:'node',pool:'forks',maxWorkers:1,minWorkers:1,setupFiles:[],include:['${testFile}']}});`;
const configName = '.issa-footer.vitest.config.mjs';
let browser, server, control;
try {
  console.log('ISSA_RELEASE_SOURCE ' + JSON.stringify({ head, base, mode }));
  // Render may provide a detached checkout with no origin remote. This repository is public;
  // fetch exact comparison objects directly, without credentials or changing checkout remotes.
  for (const reference of [base, ...(mode === 'preview' ? ['908d2d4e2c76141ffe2cdcfa52e756dfb52fae84'] : [])]) {
    if (spawnSync('git', ['cat-file', '-e', reference + '^{commit}']).status !== 0) {
      run('git', ['fetch', '--no-tags', '--depth=1', 'https://github.com/infotradescout/tradescoutAI.git', reference]);
    }
  }
  // The user's accepted main layout, wording, media and product content are exact-byte boundaries.
  run('git', ['diff', '--exit-code', base, head, '--',
    'client/src/pages/profile-sites/BusinessProfileTheme.tsx',
    'client/src/pages/profile-sites/BusinessProfileTheme.css',
    'client/src/pages/profile-sites/TradeScoutProfileHandoff.tsx',
    'shared/issaBuildProfile.ts', 'shared/issaBuildPageContent.ts',
    'server/services/issaBuildProfileProvisioning.ts', 'server/services/issaBuildVerifiedProfileNormalization.ts',
    'migrations', 'client/src/pages/profile-sites/IssaBuildOnyxPage.tsx']);
  await fs.writeFile(configName, configText);
  run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', configName]);

  if (mode === 'preview') {
    control = path.join(temporary, 'control');
    run('git', ['worktree', 'add', '--detach', control, base]);
    await fs.symlink(path.join(root, 'node_modules'), path.join(control, 'node_modules'), 'dir');
    await fs.copyFile(path.join(root, testFile), path.join(control, testFile));
    await fs.writeFile(path.join(control, configName), configText);
    const reportFile = path.join(temporary, 'negative-control.json');
    const negative = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', configName, '--reporter=json', '--outputFile=' + reportFile], { cwd: control, stdio: 'inherit', env });
    const report = JSON.parse(await fs.readFile(reportFile, 'utf8'));
    assert.notEqual(negative.status, 0);
    assert.ok(report.numTotalTests > 0 && report.numFailedTests >= 4, 'The unchanged release must reproduce actual test failures, not a failed runner');
    result.negativeControl = { total: report.numTotalTests, failed: report.numFailedTests, source: base };
    run('git', ['worktree', 'remove', '--force', control]); control = null;
    console.log('ISSA_NEGATIVE_CONTROL ' + JSON.stringify(result.negativeControl));

    const dependencies = path.join(temporary, 'native-dependencies');
    run('npm', ['install', '--prefix', dependencies, '--no-audit', '--no-fund', '--package-lock=false', 'embedded-postgres@18.4.0-beta.17']);
    const require = createRequire(import.meta.url);
    const nativeModule = require.resolve('embedded-postgres', { paths: [dependencies] });
    run(process.execPath, ['scripts/tests/database-bootstrap.native.mjs'], { env: { ...env, EMBEDDED_POSTGRES_MODULE: nativeModule, DB598_ISOLATE_CHECKOUT: '1', DB598_FULL_RELEASE: '1', DB598_EXPECTED_HEAD: head } });
    const evidence = JSON.parse(await fs.readFile('.db-bootstrap-proof/release-evidence.json', 'utf8'));
    assert.equal(evidence.commit, head); assert.equal(evidence.result, 'pass'); assert.equal(evidence.dirtyTree, false);
    assert.ok(evidence.steps.every((step) => step.status === 'pass'));
    result.minimumRelease = { commit: evidence.commit, result: evidence.result, dirtyTree: evidence.dirtyTree, steps: evidence.steps.map(({ name, status }) => ({ name, status })) };
    await fs.copyFile('.db-bootstrap-proof/release-evidence.json', path.join(output, 'release-evidence.json'));
    console.log('ISSA_MINIMUM_RELEASE ' + JSON.stringify(result.minimumRelease));
  } else {
    assert.match(process.env.ISSA_EXPECTED_COMMIT || '', /^[a-f0-9]{40}$/);
    const version = await (await fetch(origin + '/api/version?footerProof=' + Date.now())).json();
    assert.equal(version.commit || version.buildRevision, process.env.ISSA_EXPECTED_COMMIT);
    result.productionCommit = version.commit || version.buildRevision;
  }

  // This existing verifier builds the actual client, checks four viewports and preserves all request/Onyx boundaries.
  run(process.execPath, ['scripts/verify-business-profile-review.mjs'], { env: { ...env, PROFILE_PROOF_MODE: mode, PROFILE_EXPECTED_COMMIT: process.env.ISSA_EXPECTED_COMMIT || '' } });
  const profileProof = JSON.parse(await fs.readFile('.business-profile-proof/result.json', 'utf8'));
  assert.equal(profileProof.source, head); assert.equal(profileProof.passed, true);
  result.profileViewports = profileProof.pages.map(({ size, passed }) => ({ size, passed }));
  await fs.copyFile('.business-profile-proof/result.json', path.join(output, 'profile-browser-result.json'));

  const publicDir = path.join(root, 'dist/public');
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2' };
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
  server = http.createServer(async (req, res) => {
    try {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (/^\/(api|images|uploads|media)\//.test(pathname)) {
        const response = await fetch(origin + req.url, { headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(30000) });
        res.writeHead(response.status, { 'content-type': response.headers.get('content-type') || 'application/octet-stream' });
        res.end(Buffer.from(await response.arrayBuffer())); return;
      }
      let target = path.resolve(publicDir, '.' + pathname);
      if (!target.startsWith(publicDir + path.sep)) target = path.join(publicDir, 'index.html');
      try { if (!(await fs.stat(target)).isFile()) throw new Error('not a file'); }
      catch { target = path.join(publicDir, 'index.html'); }
      res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream' });
      res.end(await fs.readFile(target));
    } catch { res.writeHead(502); res.end('Public resource unavailable'); }
  });
  await new Promise((resolve) => server.listen(4174, '127.0.0.1', resolve));
  const pageOrigin = mode === 'production' ? origin : 'http://127.0.0.1:4174';
  browser = await chromium.launch({ headless: true });
  for (const [size, width, height] of [['small-mobile', 320, 740], ['mobile', 390, 844], ['tablet', 768, 1024], ['desktop', 1440, 1000]]) {
    const context = await browser.newContext({ viewport: { width, height }, userAgent, serviceWorkers: 'block' });
    await context.route('**/*', (route) => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    assert.equal((await page.goto(pageOrigin + '/issa-build', { waitUntil: 'domcontentloaded' })).status(), 200);
    await page.locator('.bp-footer').waitFor({ timeout: 45000 });
    await page.locator('[data-testid="profile-account-create"]').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const metrics = await page.evaluate(() => {
      const footer = document.querySelector('[data-testid="profile-tradescout-powered-link"]');
      const parse = (value) => { const numbers = value.match(/[\d.]+/g)?.map(Number) || []; return [numbers[0] || 0, numbers[1] || 0, numbers[2] || 0, numbers.length > 3 ? numbers[3] : 1]; };
      const blend = (front, back) => [0, 1, 2].map((i) => front[i] * front[3] + back[i] * (1 - front[3]));
      const ancestors = []; for (let node = footer; node; node = node.parentElement) ancestors.push(node);
      let background = [255, 255, 255];
      for (const node of ancestors.reverse()) background = blend(parse(getComputedStyle(node).backgroundColor), background);
      const foreground = blend(parse(getComputedStyle(footer).color), background);
      const luminance = (color) => color.map((channel) => { const v = channel / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      const a = luminance(foreground), b = luminance(background);
      const controls = [...document.querySelectorAll('.bp-aside button,.bp-footer a')].filter((element) => element.getClientRects().length).map((element) => ({ text: element.textContent.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
      return {
        contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), foreground, background,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        accountTitle: parseFloat(getComputedStyle(document.querySelector('[data-testid="public-profile-account-card"] h3')).fontSize),
        asideHeight: document.querySelector('.bp-aside').getBoundingClientRect().height,
        footerHeight: document.querySelector('.bp-footer').getBoundingClientRect().height,
        controls,
      };
    });
    assert.ok(metrics.contrast >= 4.5, 'Footer text must remain readable on the actual profile background');
    assert.equal(metrics.overflow, false);
    assert.ok(metrics.accountTitle <= 22);
    assert.ok(metrics.controls.every((control) => control.height >= 43 && control.width > 0));
    assert.equal(await page.getByTestId('profile-tradescout-powered-link').getAttribute('href'), '/');
    assert.ok(await page.getByText('100% Verified by TradeScout', { exact: true }).isVisible());
    await page.getByTestId('profile-tradescout-powered-link').focus();
    assert.equal(await page.getByTestId('profile-tradescout-powered-link').evaluate((element) => getComputedStyle(element).outlineStyle), 'solid');
    await page.screenshot({ path: path.join(output, `footer-${size}.jpg`), type: 'jpeg', quality: 82 });
    if (size === 'desktop' || size === 'mobile') {
      // Small actual-browser crops for internal visual inspection, not generated mockups.
      const image = await page.locator('.bp-aside').screenshot({ type: 'jpeg', quality: 50 });
      const imagePage = await context.newPage();
      const encoded = await imagePage.evaluate(async (data) => {
        const img = new Image(); img.src = data; await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = Math.round(img.height * 360 / img.width);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', .2).split(',')[1];
      }, 'data:image/jpeg;base64,' + image.toString('base64'));
      await imagePage.close();
      await fs.writeFile(path.join(output, `footer-${size}-small.jpg`), Buffer.from(encoded, 'base64'));
      for (let part = 0, offset = 0; offset < encoded.length; offset += 5000, part++) console.log(`ISSA_FOOTER_VISUAL_${size}_${part} ` + encoded.slice(offset, offset + 5000));
    }
    assert.equal((await page.goto(pageOrigin + '/pensacola', { waitUntil: 'domcontentloaded' })).status(), 200);
    const services = page.locator('section[aria-label="Kitchen and bathroom services"] h2 a');
    await services.first().waitFor({ timeout: 30000 });
    assert.equal(await services.count(), 4);
    for (const link of await services.all()) assert.equal(await link.getAttribute('href'), '/issa-build#profile-services');
    assert.equal(await page.locator('figure a').first().getAttribute('href'), '/issa-build/onyx');
    await services.first().click(); await page.locator('#profile-services').waitFor({ timeout: 30000 });
    assert.equal(new URL(page.url()).pathname, '/issa-build');
    assert.equal(new URL(page.url()).hash, '#profile-services');
    assert.equal(errors.length, 0);
    result.pages.push({ size, ...metrics, passed: true });
    console.log('ISSA_FOOTER_BROWSER ' + JSON.stringify(result.pages.at(-1)));
    await context.close();
  }
  if (mode === 'production') {
    for (const pathname of ['/sitemap-u-profiles.xml', '/sitemap-profile-images.xml']) {
      const response = await fetch(origin + pathname + '?footerProof=' + Date.now(), { signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200);
      const text = await response.text();
      assert.match(response.headers.get('content-type'), /xml/);
      for (const destination of ['/issa-build', '/issa-build/onyx', '/issa-build/onyx/inventory/honey-onyx', '/issa-build/onyx/inventory/multi-green-onyx']) assert.ok(text.includes(`<loc>${origin}${destination}</loc>`), `Missing canonical in ${pathname}: ${destination}`);
      assert.ok(!text.includes(`<loc>${origin}/u/issa-build`));
      result.discovery.push({ pathname, status: response.status, canonicalDestinations: 4, passed: true });
    }
    const response = await fetch(origin + '/pensacola?footerProof=' + Date.now());
    const html = await response.text(); assert.equal(response.status, 200);
    assert.equal((html.match(/href="\/issa-build#profile-services"/g) || []).length, 4);
    assert.ok(!/href="[^\"]*issa-build\/services\//.test(html));
    const healthResponse = await fetch(origin + '/api/health?footerProof=' + Date.now());
    const health = await healthResponse.json(); assert.equal(healthResponse.status, 200);
    assert.equal(health.commit, process.env.ISSA_EXPECTED_COMMIT);
    assert.equal(health.migrations.requiredSchemaOk, true); assert.equal(health.migrations.compatibility, 'compatible');
    assert.ok(['ok', 'healthy'].includes(health.status));
    result.health = { status: health.status, commit: health.commit, migrations: health.migrations };
  }
  result.passed = true;
} catch (error) {
  result.failure = error.message;
  console.error('ISSA_RELEASE_FAILURE', error.stack);
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (control) run('git', ['worktree', 'remove', '--force', control]);
  await fs.rm(temporary, { recursive: true, force: true });
  result.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
  await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><html lang="en"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ISSA Build footer and discovery verification</title><main><h1>ISSA Build verification</h1><p><a href="https://www.thetradescout.com/issa-build">Open the live ISSA Build page</a></p><p><a href="result.json">Verification record</a></p></main></html>');
  console.log('ISSA_RELEASE_RESULT ' + JSON.stringify(result));
}
if (!result.passed) process.exitCode = 1;
