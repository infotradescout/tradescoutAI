import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = process.cwd();
const phase = process.env.PROFILE_ROOT_PROOF_PHASE || 'release';
assert(['release', 'production', 'audit'].includes(phase));
const out = path.resolve(process.env.PROFILE_ROOT_PROOF_OUTPUT || 'test-results/profile-root-discovery');
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'root-link-proof-'));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
const expected = process.env.PROFILE_ROOT_EXPECTED_SHA || '';
const base = 'https://www.thetradescout.com';
const services = ['kitchen-projects', 'bathroom-projects', 'cabinets', 'countertops-fabrication'];
const targets = [...services.map(slug => `/u/issa-build/services/${slug}`), '/u/issa-build/service-areas'];
const agents = {
  browser: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  crawlerDiagnostic: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html; TradeScoutReadOnlyAudit/1.0)',
};
const report = { head, tree, phase, startedAt: new Date().toISOString(), checks: [], pages: [], passed: false, googleIndexVerified: false, externalDeliveryTested: false };
let browser;
const clean = () => execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
const decode = value => String(value).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const attr = (tag, name) => decode(tag.match(new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i'))?.[1] || '');
function run(name, args, extra = {}) {
  console.log('PROFILE_ROOT_START ' + name);
  const startedAt = new Date().toISOString();
  const result = spawnSync(args[0], args.slice(1), { cwd: root, env: { ...process.env, ...extra }, encoding: 'utf8', timeout: 1800000, maxBuffer: 100 * 1024 * 1024 });
  const log = ((result.stdout || '') + (result.stderr || '')).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[ISOLATED_DATABASE]');
  console.log(log);
  report.checks.push({ name, startedAt, finishedAt: new Date().toISOString(), passed: result.status === 0, status: result.status, tail: log.slice(-5000) });
  assert.equal(result.status, 0, name + ' failed');
}
async function read(pathname, agent = 'browser') {
  const url = new URL(pathname, base);
  assert.equal(url.origin, base);
  const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': agents[agent] }, signal: AbortSignal.timeout(20000) });
  return { url: url.href, agent, status: response.status, build: response.headers.get('x-tradescout-build'), headerRobots: response.headers.get('x-robots-tag'), location: response.headers.get('location'), body: await response.text() };
}
function summarize(raw) {
  const links = [...raw.body.matchAll(/<a\b[^>]*>/gi)].map(m => attr(m[0], 'href')).filter(Boolean);
  const canonical = [...raw.body.matchAll(/<link\b[^>]*>/gi)].filter(m => attr(m[0], 'rel') === 'canonical').map(m => attr(m[0], 'href'));
  const robots = [...raw.body.matchAll(/<meta\b[^>]*>/gi)].filter(m => ['robots', 'googlebot'].includes(attr(m[0], 'name'))).map(m => attr(m[0], 'content'));
  return { ...raw, body: undefined, canonical, robots, links, serviceLinks: links.filter(link => targets.some(target => link === base + target)), title: decode(raw.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') };
}
function requireIndexable(page) {
  assert.equal(page.status, 200, page.url);
  if (phase === 'production') assert.equal(page.build, expected, page.url + ' has wrong build');
  assert.deepEqual(page.canonical, [page.url], page.url + ' canonical mismatch');
  assert(!/\bnoindex\b/i.test([...page.robots, page.headerRobots].join(';')), page.url + ' unexpectedly noindex');
}
async function browserPages() {
  run('Install Chromium', [process.execPath, 'node_modules/playwright/cli.js', 'install', 'chromium']);
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  report.browser = [];
  for (const [device, viewport] of [['desktop', { width: 1440, height: 1000 }], ['touch', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: device === 'touch', isMobile: device === 'touch', serviceWorkers: 'block', userAgent: agents.browser });
    const errors = [], failedAssets = [], blockedWrites = [];
    await context.route('**/*', route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) { blockedWrites.push(new URL(route.request().url()).pathname); return route.abort('blockedbyclient'); }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && ['script', 'stylesheet'].includes(response.request().resourceType())) failedAssets.push({ path: new URL(response.url()).pathname, status: response.status() }); });
    const steps = [];
    for (const pathname of ['/issa-build', ...targets]) {
      const response = await page.goto(base + pathname, { waitUntil: 'domcontentloaded', timeout: 60000 });
      assert.equal(response.status(), 200); assert.equal(response.headers()['x-tradescout-build'], expected);
      assert.equal(new URL(page.url()).pathname, pathname);
      await page.locator('h1').first().waitFor();
      const visibleText = await page.locator('body').innerText();
      assert(visibleText.includes('ISSA Build')); assert(!visibleText.includes('We could not render the app yet'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, pathname + ' horizontal overflow');
      if (pathname !== '/issa-build') {
        // These server-rendered public pages retain a real return link, not a JS-only action.
        const returnLink = page.locator('a').filter({ hasText: /ISSA Build|View full profile/i }).first();
        assert(await returnLink.count());
      }
      const screenshot = device + '-' + pathname.split('/').filter(Boolean).join('-') + '.png';
      await page.screenshot({ path: path.join(out, screenshot), fullPage: true });
      steps.push({ path: pathname, passed: true, screenshot });
    }
    assert.deepEqual(errors, []); assert.deepEqual(failedAssets, []);
    report.browser.push({ device, steps, errors, failedAssets, blockedWrites, passed: true });
    await context.close();
  }
}
try {
  assert.equal(clean(), '');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'SENDGRID_API_KEY', 'BREVO_API_KEY', 'RESEND_API_KEY', 'SMTP_PASS', 'STRIPE_SECRET_KEY']) assert(!process.env[key], key + ' must not be inherited');
  if (phase === 'release') {
    const files = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], { encoding: 'utf8' }).trim().split('\n').filter(file => /public-profile-root-discovery|profile-service|profileService|public-seo-html|landing-contract/i.test(file));
    assert(files.includes('server/tests/public-profile-root-discovery.behavior.test.ts'));
    const testReport = path.join(temporary, 'tests.json');
    run('Root identity, real link owners and existing service contracts', ['npm', 'run', 'test:run', '--', ...files, '--maxWorkers=2', '--reporter=default', '--reporter=json', '--outputFile=' + testReport]);
    const tests = JSON.parse(await fs.readFile(testReport, 'utf8'));
    report.tests = Object.fromEntries(['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests'].map(key => [key, tests[key]]));
    assert.equal(tests.numFailedTests, 0); assert.equal(tests.numPendingTests, 0);
    const preserved = path.join(temporary, 'existing-release');
    run('Preserved sitemap, ISSA, compiled startup and strict customer release', [process.execPath, 'scripts/verify-sitemap-page-parity.mjs'], { SITEMAP_PROOF_PHASE: 'release', SITEMAP_PROOF_OUTPUT: preserved });
    const evidence = JSON.parse(await fs.readFile(path.join(preserved, 'evidence.json'), 'utf8'));
    assert.equal(evidence.head, head); assert.equal(evidence.passed, true); assert.equal(evidence.release.compiledBoot, true);
    assert.equal(evidence.release.minimumRelease.commit, head); assert.equal(evidence.release.minimumRelease.attestable, true);
    report.release = evidence.release;
  } else {
    if (phase === 'production') assert.match(expected, /^[a-f0-9]{40}$/);
    report.expectedDeployed = expected || null;
    for (const agent of Object.keys(agents)) {
      const page = summarize(await read('/issa-build', agent)); report.pages.push(page); requireIndexable(page);
      if (phase === 'production') {
        assert.equal(new Set(page.serviceLinks).size, 5, agent + ' root must expose all five existing destinations');
        for (const target of targets) assert(page.links.includes(base + target));
        assert(page.links.includes(base + '/issa-build/onyx'), 'Product navigation must remain');
      }
    }
    for (const target of targets) { const page = summarize(await read(target)); report.pages.push(page); requireIndexable(page); }
    const sitemap = await read('/sitemap-u-profiles.xml'); assert.equal(sitemap.status, 200);
    const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => decode(m[1]));
    report.sitemap = { status: sitemap.status, count: urls.length, issaUrls: urls.filter(url => url.includes('issa-build')) };
    assert(urls.includes(base + '/issa-build'));
    for (const target of targets) assert(urls.includes(base + target), 'Existing target must remain in sitemap');
    const inactive = await read('/contractors/issa-build'); assert.equal(inactive.status, 404);
    report.inactiveLegacyControl = { status: inactive.status, url: inactive.url };
    const health = await read('/api/health'); report.health = JSON.parse(health.body); assert.equal(health.status, 200);
    assert.equal(report.health.status, 'healthy'); assert.equal(report.health.database, 'connected'); assert.equal(report.health.migrations.requiredSchemaOk, true);
    if (phase === 'production') {
      assert.equal(health.build, expected); assert.equal(report.health.commit, expected); assert.equal(report.health.migrations.compatibility, 'compatible');
      await fs.mkdir(out, { recursive: true }); await browserPages();
    }
  }
  report.finalSourceStatus = clean(); assert.equal(report.finalSourceStatus, ''); report.passed = true;
} catch (error) {
  report.error = String(error.stack || error); console.error('PROFILE_ROOT_FAILURE ' + report.error);
} finally {
  await browser?.close(); report.finishedAt = new Date().toISOString();
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(out, 'index.html'), '<meta name="robots" content="noindex,nofollow"><h1>' + (report.passed ? 'Declared root discovery checks passed' : 'FAILED — not approval') + '</h1><p>' + phase + ' ' + head + '</p><p>Not a Google indexing, ranking or customer acquisition claim.</p><a href="evidence.json">Evidence</a>');
  await fs.rm(temporary, { recursive: true, force: true });
  console.log('PROFILE_ROOT_SUMMARY ' + JSON.stringify({ ...report, checks: report.checks.map(({ tail, ...check }) => check) }));
}
