/** Executes whole published modules after TypeScript transpilation. Handler fixtures are not a full Express/server or indexing acceptance test. */
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ts = require(process.env.PUBLIC_INFORMATION_TYPESCRIPT || 'typescript');
const root = process.cwd();
const temporary = mkdtempSync(path.join(tmpdir(), 'public-information-tests-'));
after(() => rmSync(temporary, { recursive: true, force: true }));
const sourceHashes = {};
for (const relative of ['server/publicInformationPages.ts', 'shared/brand.ts']) {
  const source = readFileSync(path.join(root, relative), 'utf8');
  sourceHashes[relative] = createHash('sha256').update(source).digest('hex');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }, reportDiagnostics: true });
  assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const target = path.join(temporary, relative.replace(/\.ts$/, '.js'));
  mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, compiled.outputText);
}
console.log('PUBLIC_INFORMATION_EXACT_SOURCES ' + JSON.stringify(sourceHashes));
const { PUBLIC_INFORMATION_PAGES, buildPublicInformationHtml, resolvePublicInformationPath, registerPublicInformationRoutes } = require(path.join(temporary, 'server/publicInformationPages.js'));
const { formatTradeScoutTitle } = require(path.join(temporary, 'shared/brand.js'));
const template = `<!doctype html><html><head><title>Generic</title><title>Duplicate</title>
<meta content="old" name="description"><meta NAME='description' content='duplicate'>
<meta property="og:title" content="old"><meta content="old" property="og:url">
<link href="https://wrong.invalid/" rel='canonical'><link rel="canonical" href="https://duplicate.invalid/">
<script type="module" crossorigin src="/assets/entry.js"></script></head><body><div id="root"></div>
<div id="ts-boot-fallback"><section>Startup failure</section></div><noscript><div id="ts-boot-fallback-noscript">Enable JavaScript</div></noscript>
<script>window.existingBootRecovery=true</script></body></html>`;
const count = (html, regex) => [...html.matchAll(regex)].length;
for (const [route, definition] of Object.entries(PUBLIC_INFORMATION_PAGES)) {
  test(`${route}: unique page metadata, readable content, links and existing app entry`, () => {
    const html = buildPublicInformationHtml(template, route);
    const canonical = 'https://www.thetradescout.com' + route;
    assert.equal(count(html, /<title\b/gi), 1);
    assert.equal(count(html, /<link\b[^>]*\brel=['"]canonical['"]/gi), 1);
    assert.equal(count(html, /<meta\b[^>]*\bname=['"]description['"]/gi), 1);
    assert.ok(html.includes(`<title>${formatTradeScoutTitle(definition.title)}</title>`));
    assert.ok(html.includes(`href="${canonical}"`));
    assert.ok(html.includes(`property="og:url" content="${canonical}"`));
    assert.ok(html.includes(`<h1>${definition.heading}</h1>`));
    assert.ok(html.includes('data-public-information-page="true"'));
    assert.ok(html.includes('/assets/entry.js')); assert.ok(html.includes('window.existingBootRecovery=true'));
    assert.ok(!html.includes('Startup failure')); assert.ok(!html.includes('Enable JavaScript'));
    assert.ok(!html.includes('data-seo-')); assert.ok(!html.includes('display:none')); assert.ok(!html.includes('visibility:hidden'));
    assert.ok(definition.paragraphs.join(' ').length >= 200);
    for (const [href] of definition.links) assert.ok(html.includes(`href="${href}"`));
    const structured = JSON.parse(html.match(/<script type="application\/ld\+json" data-public-information-schema="true">([\s\S]*?)<\/script>/)[1]);
    assert.equal(structured['@type'], 'WebPage'); assert.equal(structured.url, canonical); assert.equal(structured.description, definition.description);
  });
}
test('only explicit informational routes qualify; private, unknown and prototype routes do not', () => {
  for (const value of ['/contact', '/direct-connect', '/admin', '/dashboard', '/api/admin', '/community', '/maps', '/about?x=1', '//about', '/%61bout', '/about//', '/unknown', '__proto__', 'constructor']) assert.equal(resolvePublicInformationPath(value), null, value);
  assert.equal(resolvePublicInformationPath('/about/'), '/about');
  assert.throws(() => buildPublicInformationHtml(template, '/admin'), /Unapproved/);
});
test('malformed or nonempty templates fail closed instead of claiming a useful page', () => {
  assert.throws(() => buildPublicInformationHtml('<html><body></body></html>', '/about'), /Expected/);
  assert.throws(() => buildPublicInformationHtml(template.replace('<div id="root"></div>', '<div id="root">other-owner</div>'), '/about'), /Expected/);
});
function exercise({ method = 'GET', route = '/about', originalUrl = route, host = 'www.thetradescout.com', failTemplate = false } = {}) {
  let handler; let reads = 0; let nextCalls = 0;
  registerPublicInformationRoutes({ use: value => { handler = value; } }, { readTemplate: () => { reads++; if (failTemplate) throw new Error('isolated template failure'); return template; } });
  const response = { headers: {}, statusCode: null, body: null, redirectTarget: null, setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; }, status(value) { this.statusCode = value; return this; }, type(value) { this.contentType = value; return this; }, send(value) { this.body = value; return this; }, redirect(status, target) { this.statusCode = status; this.redirectTarget = target; return this; } };
  handler({ method, path: route, originalUrl, headers: { host } }, response, () => { nextCalls++; });
  return { response, reads, nextCalls };
}
test('production GET and HEAD execute the same informational response handler', () => {
  for (const method of ['GET', 'HEAD']) {
    const result = exercise({ method }); assert.equal(result.response.statusCode, 200); assert.equal(result.reads, 1); assert.equal(result.nextCalls, 0);
    assert.ok(result.response.body.includes('About TradeScout')); assert.equal(result.response.headers['x-robots-tag'], undefined);
  }
});
test('unsafe methods, private/action routes and custom domains are untouched', () => {
  for (const options of [{ method: 'POST' }, { method: 'DELETE' }, { method: 'OPTIONS' }, { route: '/direct-connect' }, { route: '/contact' }, { route: '/admin' }, { host: 'jwstonelogistics.com' }, { host: 'www.thetradescout.com.evil.invalid' }, { host: '' }]) {
    const result = exercise(options); assert.equal(result.nextCalls, 1); assert.equal(result.reads, 0); assert.equal(result.response.statusCode, null);
  }
});
test('trailing slash redirects once and preserves the existing query without affecting the canonical', () => {
  const result = exercise({ route: '/about/', originalUrl: '/about/?utm_source=example' });
  assert.equal(result.response.statusCode, 308); assert.equal(result.response.redirectTarget, '/about?utm_source=example'); assert.equal(result.reads, 0);
  const normal = exercise({ originalUrl: '/about?canonical=https://evil.invalid/' });
  assert.ok(normal.response.body.includes('href="https://www.thetradescout.com/about"')); assert.ok(!normal.response.body.includes('evil.invalid'));
});
test('local/preview documents have production canonicals plus noindex response protection', () => {
  const result = exercise({ host: '127.0.0.1:5000' }); assert.equal(result.response.statusCode, 200); assert.equal(result.response.headers['x-robots-tag'], 'noindex');
  assert.ok(result.response.body.includes('href="https://www.thetradescout.com/about"'));
});
test('template failure returns 503 noindex and is never an indexable blank 200', () => {
  const originalError = console.error; console.error = () => {};
  try { const result = exercise({ failTemplate: true }); assert.equal(result.response.statusCode, 503); assert.equal(result.response.headers['x-robots-tag'], 'noindex'); assert.equal(result.response.headers['cache-control'], 'no-store'); }
  finally { console.error = originalError; }
});
test('production registration retains ISSA and existing aliases before fallback', () => {
  const source = readFileSync(path.join(root, 'server/publicShellAliasRoutes.ts'), 'utf8');
  assert.match(source, /import \{ registerPublicInformationRoutes \} from "\.\/publicInformationPages"/);
  assert.equal(count(source, /registerPublicInformationRoutes\(app\)/g), 1);
  assert.match(source, /registerIssaBuildPublicRoutes\(app\)/);
  assert.ok(source.indexOf('registerPublicInformationRoutes(app)') < source.indexOf('app.head(paths'));
  assert.match(source, /app\.get\(paths, redirectPublicShellAlias\)/);
});
