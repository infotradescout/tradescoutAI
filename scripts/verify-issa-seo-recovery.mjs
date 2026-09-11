import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const phase = process.env.ISSA_SEO_PHASE || 'audit';
assert(['audit', 'release', 'live'].includes(phase));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.resolve(process.env.ISSA_SEO_OUTPUT || '.issa-seo-proof');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'issa-seo-proof-'));
const origin = 'https://www.thetradescout.com';
const serviceSlugs = ['kitchen-projects', 'bathroom-projects', 'cabinets', 'countertops-fabrication'];
const proof = { head, phase, startedAt: new Date().toISOString(), passed: false, searchIndexVerified: false, steps: [], pages: [] };
const agents = {
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
};
function run(name, command, extra = {}) {
  console.log('ISSA_START ' + name);
  const result = spawnSync(command[0], command.slice(1), { cwd: process.cwd(), env: { ...process.env, ...extra }, encoding: 'utf8', maxBuffer: 70 * 1024 * 1024, timeout: 1500000 });
  const text = ((result.stdout || '') + (result.stderr || '')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[LOCAL_TEST_DATABASE]');
  console.log(text);
  const step = { name, passed: result.status === 0, status: result.status, error: result.error?.message, tail: text.slice(-4000) };
  proof.steps.push(step); console.log('ISSA_STEP ' + JSON.stringify({ ...step, tail: undefined }));
  assert.equal(result.status, 0, name);
}
async function health(strict = false) {
  const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  const evidence = { checkedAt: new Date().toISOString(), status: response.status, build: response.headers.get('x-tradescout-build'), body };
  if (strict) {
    const expected = process.env.ISSA_SEO_DEPLOYED_SHA;
    assert.equal(response.status, 200); assert.equal(evidence.build, expected); assert.equal(body.commit, expected);
    assert.equal(body.status, 'healthy'); assert.equal(body.database, 'connected'); assert.equal(body.migrations?.compatibility, 'compatible');
  }
  return evidence;
}
function checkOptionalPageBuild(build, route) {
  // Early service middleware precedes the build-header owner. Record absence,
  // never fabricate per-response SHA proof. Root and surrounding health MUST match.
  if (build !== null && build !== undefined) assert.equal(build, process.env.ISSA_SEO_DEPLOYED_SHA, route + ' build');
}
async function inspect(route, agent) {
  const response = await fetch(origin + route, { redirect: 'manual', headers: { 'user-agent': agents[agent] }, signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  const canonical = [...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
  const robots = [...html.matchAll(/<meta\b[^>]*name=["'](?:robots|googlebot)["'][^>]*content=["']([^"']+)["'][^>]*>/gi)].map(match => match[1]);
  const page = { route, agent, status: response.status, build: response.headers.get('x-tradescout-build'), bodySha256: createHash('sha256').update(html).digest('hex'), location: response.headers.get('location'), xRobots: response.headers.get('x-robots-tag'), canonical, robots, title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(match => match[1].replace(/<[^>]*>/g, '')), hasServiceIdentity: html.includes('"@type":"Service"'), hasClientModule: /<script\b[^>]*type=["']module/.test(html) };
  proof.pages.push(page); console.log('ISSA_PAGE ' + JSON.stringify(page));
  return { page, html };
}
async function audit(strict = false) {
  const expected = process.env.ISSA_SEO_DEPLOYED_SHA || '';
  if (strict) assert.match(expected, /^[a-f0-9]{40}$/);
  proof.healthBefore = await health(strict);
  for (const agent of ['browser', 'googlebot']) {
    for (const route of ['/issa-build', ...serviceSlugs.map(slug => '/u/issa-build/services/' + slug)]) {
      const { page, html } = await inspect(route, agent);
      if (!strict) continue;
      assert.equal(page.status, 200, route);
      if (route === '/issa-build') assert.equal(page.build, expected);
      else checkOptionalPageBuild(page.build, route);
      assert.deepEqual(page.canonical, [origin + route], route + ' canonical');
      assert(!page.xRobots?.includes('noindex')); assert(!page.robots.some(value => /noindex/i.test(value)));
      assert(page.h1.length > 0); assert(html.includes('ISSA Build'));
      if (route.includes('/services/')) { assert(page.hasServiceIdentity); assert(!page.hasClientModule); }
    }
  }
  const sitemap = await fetch(origin + '/sitemap-u-profiles.xml', { signal: AbortSignal.timeout(20000) });
  const sitemapXml = await sitemap.text();
  const urls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  proof.sitemap = { status: sitemap.status, issaUrls: urls.filter(url => url.includes('issa-build')) };
  if (strict) {
    assert.equal(sitemap.status, 200); assert(urls.includes(origin + '/issa-build'));
    for (const slug of serviceSlugs) assert(urls.includes(origin + '/u/issa-build/services/' + slug), 'Service missing from live sitemap: ' + slug);
  }
  proof.healthAfter = await health(strict);
}
async function browserProof() {
  run('Install Chromium', [process.execPath, 'node_modules/playwright/cli.js', 'install', 'chromium']);
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  proof.browser = [];
  try {
    for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport, isMobile: device === 'touch', hasTouch: device === 'touch', serviceWorkers: 'block', userAgent: agents.browser });
      const errors = [];
      await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort('blockedbyclient'));
      const page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
      for (const slug of serviceSlugs) {
        const response = await page.goto(origin + '/u/issa-build/services/' + slug, { waitUntil: 'networkidle', timeout: 45000 });
        assert(response?.ok());
        const build = response.headers()['x-tradescout-build'] || null;
        checkOptionalPageBuild(build, slug);
        await page.locator('[data-public-profile-service-page="true"] h1').waitFor();
        const headings = await page.locator('h1').allTextContents(); assert.equal(headings.length, 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, slug + ' horizontal overflow');
        assert.equal(await page.getByRole('link', { name: 'Start a Request', exact: true }).count(), 1);
        assert.equal(await page.getByRole('link', { name: 'View full profile', exact: true }).count(), 1);
        await page.screenshot({ path: path.join(output, device + '-' + slug + '.png'), fullPage: true });
        proof.browser.push({ device, slug, passed: true, build, heading: headings[0] });
      }
      assert.deepEqual(errors, []); await context.close();
    }
    proof.healthAfterBrowser = await health(true);
  } finally { await browser.close(); }
}
try {
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
  await fs.mkdir(output, { recursive: true });
  if (phase === 'audit') { await audit(); proof.passed = true; }
  if (phase === 'release') {
    run('Existing ISSA business/product separation checks', [process.execPath, '--test', 'scripts/tests/issa-build-page-separation.test.mjs']);
    const tracked = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], { encoding: 'utf8' }).trim().split('\n');
    const files = tracked.filter(file => !file.startsWith('scripts/') && /issa|profile-service|profile-sitemap|public-profile-contact/i.test(file));
    assert(files.length >= 5);
    run('Affected service, sitemap, public-contact and ISSA tests', ['npm', 'run', 'test:run', '--', ...files, '--maxWorkers=2', '--reporter=default', '--reporter=json', '--outputFile=' + path.join(temporary, 'tests.json')]);
    const tests = JSON.parse(await fs.readFile(path.join(temporary, 'tests.json'), 'utf8'));
    proof.tests = { passed: tests.numPassedTests, failed: tests.numFailedTests, pending: tests.numPendingTests };
    assert.equal(tests.numFailedTests, 0); assert.equal(tests.numPendingTests, 0);
    const releaseOutput = path.join(temporary, 'release');
    run('Compiled startup and complete existing release contract', [process.execPath, 'scripts/diagnose-compiled-startup.mjs'], { STARTUP_PHASE: 'release', STARTUP_PROOF_OUTPUT: releaseOutput });
    proof.release = JSON.parse(await fs.readFile(path.join(releaseOutput, 'evidence.json'), 'utf8'));
    assert.equal(proof.release.head, head); assert.equal(proof.release.passed, true); assert.equal(proof.release.compiledBoot, true);
    assert.equal(proof.release.customerRelease?.minimumRelease?.attestable, true);
    assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
    proof.passed = true;
  }
  if (phase === 'live') { await audit(true); await browserProof(); proof.passed = true; }
} catch (error) {
  proof.error = String(error.stack || error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[LOCAL_TEST_DATABASE]');
  console.error('ISSA_FAILURE ' + proof.error);
} finally {
  proof.finishedAt = new Date().toISOString();
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(proof, null, 2));
  await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(output, 'index.html'), '<!doctype html><meta name="robots" content="noindex,nofollow"><h1>ISSA public-page verification</h1><p>' + phase + ': ' + (proof.passed ? 'Declared checks passed' : 'FAILED') + '</p><p>This is not Google index verification.</p><a href="evidence.json">Evidence</a>');
  await fs.rm(temporary, { recursive: true, force: true });
  console.log('ISSA_SUMMARY ' + JSON.stringify({ ...proof, release: proof.release ? { head: proof.release.head, passed: proof.release.passed, compiledBoot: proof.release.compiledBoot, minimumRelease: proof.release.customerRelease?.minimumRelease } : undefined, steps: proof.steps.map(({ tail, ...step }) => step) }));
}
// Failed reports remain available for diagnosis; a live report host is not approval.
