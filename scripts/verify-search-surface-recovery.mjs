import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const out = path.resolve(process.env.SEARCH_SURFACE_OUTPUT || 'test-results/search-surface');
const phase = process.env.SEARCH_SURFACE_PHASE || 'audit';
const scope = process.env.SEARCH_SURFACE_SCOPE || 'tradescout';
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const definitions = {
  tradescout: { base: 'https://www.thetradescout.com', health: '/api/health', paths: ['/about', '/pricing', '/help', '/trust-model', '/direct-connect-info', '/contact', '/compare', '/county-directory'] },
  mealscout: { base: 'https://www.mealscout.us', health: null, paths: ['/for-food-trucks', '/for-restaurants', '/for-hosts', '/host-location-partner'] },
  sway: { base: 'https://app.sway.tips', health: '/api/release-health', paths: ['/', '/discover', '/p/drewmaze', '/p/coreymack'] },
};
const report = { schemaVersion: 2, head, phase, scope, startedAt: new Date().toISOString(), sites: [], completed: false, indexingConfirmed: false, humanTrafficMeasured: false, note: 'Owned read-only probes. Diagnostic crawler UAs are not genuine crawler visits, indexing, rankings, referrals, or conversions.' };
let browser;
function attr(tag, key) { return (tag.match(new RegExp('\\b' + key + '\\s*=\\s*["\']([^"\']*)["\']', 'i'))?.[1] || '').replace(/&amp;/g, '&'); }
function metadata(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => ({ name: attr(m[0], 'name') || attr(m[0], 'property'), content: attr(m[0], 'content') }));
  const clean = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/&amp;/g, '&'),
    canonical: [...html.matchAll(/<link\b[^>]*>/gi)].filter(m => attr(m[0], 'rel') === 'canonical').map(m => attr(m[0], 'href')),
    meta: metas.filter(m => ['robots', 'description', 'og:title', 'og:url'].includes(m.name)),
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
    textLength: clean.length, textSample: clean.slice(0, 1800),
    clientModules: [...html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=/gi)].length,
    links: [...html.matchAll(/<a\b[^>]*>/gi)].map(m => attr(m[0], 'href')).filter(v => v.startsWith('/') && !v.startsWith('//')).map(v => v.split('?')[0]).slice(0, 30),
  };
}
const agents = { Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot)', 'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)' };
async function probe(url, agent) {
  const response = await fetch(url, { headers: { 'user-agent': agent, accept: 'text/html,application/xhtml+xml,text/plain,application/xml;q=0.9' }, signal: AbortSignal.timeout(20000), redirect: 'manual' });
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > 2000000) throw new Error('Public response exceeds bounded probe size');
  const reader = response.body?.getReader(); let size = 0; const parts = [];
  if (reader) { try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 2000000) throw new Error('Public response exceeds bounded probe size'); parts.push(Buffer.from(part.value)); } } finally { await reader.cancel().catch(() => {}); } }
  const text = Buffer.concat(parts).toString('utf8');
  return { status: response.status, contentType: response.headers.get('content-type'), headerRobots: response.headers.get('x-robots-tag'), vary: response.headers.get('vary'), location: response.headers.get('location'), build: response.headers.get('x-tradescout-build'), ...(response.headers.get('content-type')?.includes('html') ? { raw: metadata(text) } : { text: text.slice(0, 16000) }) };
}
try {
  assert.equal(phase, 'audit');
  assert.ok(scope === 'all' || Object.hasOwn(definitions, scope), 'Unknown audit scope');
  assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '');
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'BREVO_API_KEY', 'SENDGRID_API_KEY', 'SMTP_PASS', 'STRIPE_SECRET_KEY']) assert(!process.env[key]);
  const install = spawnSync(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium'], { encoding: 'utf8', timeout: 180000 });
  assert.equal(install.status, 0, install.stderr);
  browser = await chromium.launch({ channel: 'chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const [name, site] of Object.entries(definitions).filter(([name]) => scope === 'all' || name === scope)) {
    const record = { name, base: site.base, pages: [], discoveryFiles: [] }; report.sites.push(record);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort('blockedbyclient'));
    for (const pathname of site.paths) {
      const row = { path: pathname, crawlerDiagnostics: [], errors: [] }; record.pages.push(row);
      for (const [label, agent] of Object.entries(agents)) {
        try { row.crawlerDiagnostics.push({ label, ...await probe(site.base + pathname, agent) }); }
        catch (error) { row.crawlerDiagnostics.push({ label, error: String(error) }); }
      }
      const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => row.errors.push(error.message));
      try {
        const response = await page.goto(site.base + pathname, { waitUntil: 'domcontentloaded', timeout: 25000 });
        row.status = response.status(); row.raw = metadata(await response.text());
        await page.waitForFunction(() => document.body.innerText.trim().length > 120 && !/^Loading TradeScout/.test(document.body.innerText.trim()), { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(900);
        row.finalPath = new URL(page.url()).pathname;
        row.rendered = await page.evaluate(() => ({ title: document.title, canonical: [...document.querySelectorAll('link[rel="canonical"]')].map(e => e.href), h1: [...document.querySelectorAll('h1')].map(e => e.innerText), textLength: document.body.innerText.length, textSample: document.body.innerText.slice(0, 2400), horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 }));
      } catch (error) { row.error = String(error); }
      await page.close(); console.log('ACQUISITION_PAGE ' + JSON.stringify({ site: name, ...row }));
    }
    for (const pathname of ['/robots.txt', '/sitemap.xml', '/llms.txt', ...(site.health ? [site.health] : [])]) {
      try { record.discoveryFiles.push({ path: pathname, ...await probe(site.base + pathname, agents['OAI-SearchBot']) }); }
      catch (error) { record.discoveryFiles.push({ path: pathname, error: String(error) }); }
    }
    await context.close();
  }
  report.completed = true;
} catch (error) { report.error = String(error.stack || error); }
finally {
  await browser?.close(); report.finishedAt = new Date().toISOString(); await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(out, 'index.html'), '<meta name="robots" content="noindex,nofollow"><h1>Production acquisition response observations</h1><p>Execution completion is not indexing, ranking, traffic, or SEO approval.</p><a href="evidence.json">Evidence</a>');
  console.log('ACQUISITION_SUMMARY ' + JSON.stringify({ ...report, sites: report.sites.map(site => ({ name: site.name, pages: site.pages.length, errors: site.pages.filter(page => page.error).length })) }));
}
