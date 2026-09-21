import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const candidate = String(process.env.SEARCH_SURFACE_CANDIDATE_SHA || '');
assert.match(candidate, /^[a-f0-9]{40}$/);
const reviewed = JSON.parse(fs.readFileSync(new URL('./public-information-candidate.json', import.meta.url), 'utf8'));
assert.equal(candidate, reviewed.commit, 'Explicitly reviewed candidate required');
for (const hash of Object.values(reviewed.blobs)) assert.match(hash, /^[a-f0-9]{40}$/);
const output = path.resolve(process.env.SEARCH_SURFACE_OUTPUT || '.search-proof');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tradescout-information-release-'));
const checkout = path.join(temporary, 'repo');
const tools = path.join(temporary, 'tools');
const cluster = path.join(temporary, 'postgres');
const password = randomBytes(24).toString('hex');
const cleanEnv = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ', 'CI', 'PLAYWRIGHT_BROWSERS_PATH'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
const evidence = { candidate, harness: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), startedAt: new Date().toISOString(), steps: [], browser: [], result: 'fail', productionChanged: false, indexingConfirmed: false, humanTrafficMeasured: false };
fs.mkdirSync(output, { recursive: true });
let app; let browser; let pgCtl; let pgStarted = false;
const redact = value => String(value || '').replaceAll(password, '[disposable-secret]');
function run(label, command, args, options = {}) {
  const step = { label, startedAt: new Date().toISOString() }; evidence.steps.push(step);
  console.log('CANDIDATE_STEP_START ' + label);
  const result = spawnSync(command, args, { cwd: checkout, env: cleanEnv, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024, ...options });
  step.exit = result.status; step.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, label.replace(/[^a-z0-9-]/gi, '_') + '.log'), redact((result.stdout || '') + (result.stderr || '')));
  console.log(redact((result.stdout || '').slice(-16000) + (result.stderr || '').slice(-8000)));
  console.log('CANDIDATE_STEP_END ' + JSON.stringify(step));
  assert.equal(result.status, 0, `${label}: ${redact(result.error || result.stderr || 'nonzero exit')}`);
  return result.stdout.trim();
}
async function unusedPort() {
  const server = net.createServer(); await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const port = server.address().port; await new Promise(yes => server.close(yes)); return port;
}
try {
  assert.notEqual(process.getuid?.(), 0, 'Use the existing unprivileged Render build user');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'STRIPE_SECRET_KEY', 'BREVO_API_KEY', 'SENDGRID_API_KEY', 'SMTP_PASS']) assert(!process.env[key], 'No production/provider credentials permitted');
  run('clone-owned-checkout', 'git', ['clone', '--no-hardlinks', '--no-checkout', process.cwd(), checkout], { cwd: temporary });
  run('fetch-reviewed-candidate', 'git', ['fetch', '--no-tags', 'https://github.com/infotradescout/tradescoutAI.git', candidate]);
  run('checkout-reviewed-candidate', 'git', ['checkout', '--detach', candidate]);
  assert.equal(run('exact-head', 'git', ['rev-parse', 'HEAD']), candidate);
  assert.equal(run('clean-initial-tree', 'git', ['status', '--porcelain']), '');
  for (const [file, hash] of Object.entries(reviewed.blobs)) assert.equal(run('blob-' + path.basename(file), 'git', ['hash-object', file]), hash);
  run('candidate-npm-ci', 'npm', ['ci']);
  run('new-information-contract', process.execPath, ['--test', 'scripts/public-information-pages.contract.test.mjs']);
  run('candidate-typecheck', 'npm', ['run', 'check']);
  run('candidate-production-build', 'npm', ['run', 'build'], { env: { ...cleanEnv, NODE_ENV: 'production' } });
  fs.mkdirSync(tools); fs.writeFileSync(path.join(tools, 'package.json'), '{"private":true,"type":"module"}');
  run('isolated-native-postgres-package', 'npm', ['install', '--save-exact', '--no-audit', '--no-fund', '@embedded-postgres/linux-x64@16.14.0-beta.17'], { cwd: tools });
  const toolsRequire = createRequire(path.join(tools, 'package.json'));
  const binaries = await import(pathToFileURL(toolsRequire.resolve('@embedded-postgres/linux-x64')).href);
  pgCtl = binaries.pg_ctl; assert(pgCtl && binaries.initdb && binaries.postgres, 'Native binary exports missing');
  assert.match(run('native-postgres-version', binaries.postgres, ['--version'], { cwd: tools }), /PostgreSQL\) 16\.14/);
  const passwordFile = path.join(temporary, 'password'); fs.writeFileSync(passwordFile, password + '\n', { mode: 0o600 });
  run('native-initdb', binaries.initdb, ['-D', cluster, '-U', 'postgres', '--auth=scram-sha-256', '--pwfile=' + passwordFile, '--encoding=UTF8', '--no-locale'], { cwd: tools });
  const certificate = path.join(temporary, 'server.crt'); const key = path.join(temporary, 'server.key');
  run('isolated-local-tls', 'openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', certificate, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], { cwd: tools });
  fs.chmodSync(key, 0o600);
  const port = await unusedPort();
  fs.appendFileSync(path.join(cluster, 'postgresql.conf'), `\nlisten_addresses='127.0.0.1'\nport=${port}\nssl=on\nssl_cert_file='${certificate}'\nssl_key_file='${key}'\nunix_socket_directories='${temporary}'\n`);
  run('native-postgres-start', pgCtl, ['-D', cluster, '-l', path.join(temporary, 'postgres.log'), '-w', '-t', '30', 'start'], { cwd: tools }); pgStarted = true;
  const require = createRequire(path.join(checkout, 'package.json'));
  const { Client } = require('pg');
  const admin = new Client({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', ssl: { ca: fs.readFileSync(certificate, 'utf8'), rejectUnauthorized: true } });
  await admin.connect(); await admin.query('CREATE DATABASE tradescout_information_release'); await admin.end();
  const database = new URL(`postgresql://postgres:${password}@127.0.0.1:${port}/tradescout_information_release`);
  database.searchParams.set('sslmode', 'verify-full'); database.searchParams.set('sslrootcert', certificate);
  const runtimeEnv = { ...cleanEnv, DATABASE_URL: database.href, TEST_DATABASE_URL: database.href, PGSSLROOTCERT: certificate, SESSION_SECRET: randomBytes(40).toString('hex'), PUBLIC_BASE_URL: 'https://www.thetradescout.com', RENDER_GIT_COMMIT: candidate };
  run('native-migration-preflight', 'npm', ['run', 'db:migrate'], { env: runtimeEnv });
  run('native-required-schema', 'npm', ['run', 'db:verify:required'], { env: runtimeEnv });
  const appPort = await unusedPort(); const base = `http://127.0.0.1:${appPort}`;
  app = spawn(process.execPath, ['dist/index.js'], { cwd: checkout, env: { ...runtimeEnv, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(appPort) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let appLog = ''; app.stdout.on('data', b => { appLog = (appLog + redact(b)).slice(-60000); }); app.stderr.on('data', b => { appLog = (appLog + redact(b)).slice(-60000); });
  let healthy = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (app.exitCode !== null) break;
    try { const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(2000) }); const body = await response.json(); if (response.ok && body.commit === candidate) { evidence.health = body; healthy = true; break; } } catch {}
    await new Promise(yes => setTimeout(yes, 500));
  }
  fs.writeFileSync(path.join(output, 'candidate-server.log'), appLog); assert(healthy, 'Exact compiled candidate did not become healthy; see candidate-server.log');
  run('chromium-install', process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium']);
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const request = route.request(); const url = new URL(request.url());
      return ['GET', 'HEAD'].includes(request.method()) && url.origin === base ? route.continue() : route.abort('blockedbyclient');
    });
    for (const pathname of ['/about', '/pricing', '/help', '/trust-model', '/direct-connect-info']) {
      const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(base + pathname, { waitUntil: 'domcontentloaded', timeout: 30000 });
      assert.equal(response.status(), 200); const raw = await response.text(); assert(raw.includes('data-public-information-page="true"')); assert(raw.includes('<h1>')); assert(raw.includes('/assets/'));
      await page.waitForTimeout(1800);
      const rendered = await page.evaluate(() => ({ title: document.title, canonical: [...document.querySelectorAll('link[rel="canonical"]')].map(e => e.href), textLength: document.body.innerText.length, overflow: document.documentElement.scrollWidth > window.innerWidth + 1, remainingSummary: Boolean(document.querySelector('[data-public-information-page]')) }));
      assert.equal(errors.length, 0, errors.join('; ')); assert.equal(rendered.overflow, false); assert.deepEqual(rendered.canonical, ['https://www.thetradescout.com' + pathname]);
      // About uses an existing shadow root; the root summary must still have been replaced by the real app.
      assert.equal(rendered.remainingSummary, false, 'Application did not mount');
      await page.screenshot({ path: path.join(output, `candidate-${width}-${pathname.slice(1)}.png`), fullPage: true });
      const row = { width, path: pathname, status: response.status(), errors, rendered }; evidence.browser.push(row); console.log('CANDIDATE_BROWSER ' + JSON.stringify(row));
      await page.close();
    }
    await context.close();
  }
  await browser.close(); browser = null;
  run('strict-minimum-release', 'npm', ['run', 'gate:minimum-release', '--', '--browser-proof=manual', '--browser-note=Observed exact compiled candidate on desktop1440 and mobile390 for all five changed informational pages; 10 browser cases passed, app mounting and canonical preservation verified. Scope: public documents, not submitted customer actions.'], { env: runtimeEnv });
  const receipt = JSON.parse(fs.readFileSync(path.join(checkout, 'artifacts/release-contract', candidate.slice(0, 12), 'evidence.json'), 'utf8'));
  assert.equal(receipt.commit, candidate); assert.equal(receipt.result, 'pass'); assert.equal(receipt.attestable, true);
  evidence.release = receipt; assert.equal(run('clean-final-tree', 'git', ['status', '--porcelain']), ''); evidence.result = 'pass';
} catch (error) {
  evidence.error = redact(error.stack || error); console.error('CANDIDATE_FAILURE ' + evidence.error);
} finally {
  await browser?.close();
  if (app && app.exitCode === null) { app.kill('SIGTERM'); await new Promise(yes => { app.once('exit', yes); setTimeout(() => { app.kill('SIGKILL'); yes(); }, 5000).unref(); }); }
  if (pgStarted) { const stopped = spawnSync(pgCtl, ['-D', cluster, '-m', 'fast', '-w', '-t', '30', 'stop'], { env: cleanEnv, encoding: 'utf8', timeout: 45000 }); evidence.clusterStopped = stopped.status === 0; if (!evidence.clusterStopped) evidence.result = 'fail'; }
  evidence.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, 'candidate-evidence.json'), JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n'); fs.writeFileSync(path.join(output, 'index.html'), '<meta name="robots" content="noindex,nofollow"><h1>Exact candidate release evidence</h1><a href="candidate-evidence.json">Execution receipt</a><p>Not Google indexing or human acquisition evidence.</p>');
  console.log('CANDIDATE_SUMMARY ' + JSON.stringify(evidence));
  fs.rmSync(temporary, { recursive: true, force: true });
  if (evidence.result !== 'pass') process.exitCode = 1;
}
